import { env } from "cloudflare:workers";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { profiles } from "../../../db/schema";
import { authConfig, getPinSession, sameOrigin, sessionHeader } from "../../profile-auth";
import { digest } from "../../../lib/pin-session";

const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("login"), pin: z.string().min(1).max(64) }),
  z.object({ action: z.literal("select"), profileId: z.string().min(1).max(100) }),
  z.object({ action: z.literal("create"), name: z.string().trim().min(1).max(60) }),
  z.object({ action: z.literal("logout") }),
]);
const json = (data: unknown, status = 200, cookie?: string) => Response.json(data, {
  status, headers: { "Cache-Control": "no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) },
});

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Request not allowed." }, 403);
  try {
    const form = request.headers.get("content-type")?.includes("application/x-www-form-urlencoded");
    const payload = input.parse(form ? Object.fromEntries(await request.formData()) : await request.json());
    if (payload.action === "logout") {
      const cookie = await sessionHeader(request, null);
      return form ? new Response(null, { status: 303, headers: { Location: "/login", "Set-Cookie": cookie, "Cache-Control": "no-store" } }) : json({ next: "/login" }, 200, cookie);
    }
    if (!env.DB) throw new Error("Database unavailable");
    if (payload.action === "login") {
      const config = authConfig();
      const minute = Math.floor(Date.now() / 60000);
      const bucket = await digest(`${config.secret}:${request.headers.get("cf-connecting-ip") || "local"}:${minute}`);
      const attempts = await env.DB.prepare("INSERT INTO pin_attempts (bucket, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET attempts = attempts + 1 RETURNING attempts")
        .bind(bucket, (minute + 2) * 60000).first<{ attempts: number }>();
      if (!attempts || attempts.attempts > 10) return json({ error: "Too many attempts. Wait a minute and try again." }, 429);
      if ((await digest(payload.pin)) !== config.pinHash) return json({ error: "Incorrect PIN." }, 401);
      // Keep old owner IDs so existing applications and R2 documents stay attached.
      await env.DB.prepare("INSERT OR IGNORE INTO profiles (id, name, created_at) SELECT owner, 'Existing applications', MIN(created_at) FROM applications GROUP BY owner").run();
      await env.DB.prepare("DELETE FROM pin_attempts WHERE expires_at < ?").bind(Date.now()).run();
      return json({ next: "/profiles" }, 200, await sessionHeader(request, { expires: null }));
    }
    const session = await getPinSession();
    if (!session) return json({ error: "Enter the PIN to continue." }, 401);
    const db = getDb();
    let profileId: string;
    if (payload.action === "select") {
      const [profile] = await db.select().from(profiles).where(eq(profiles.id, payload.profileId));
      if (!profile) return json({ error: "Profile not found." }, 404);
      profileId = profile.id;
    } else {
      const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(profiles);
      if (total >= 1000) return json({ error: "The profile limit has been reached." }, 400);
      profileId = crypto.randomUUID();
      await db.insert(profiles).values({ id: profileId, name: payload.name, createdAt: new Date().toISOString() });
    }
    return json({ next: "/" }, 200, await sessionHeader(request, { ...session, profileId }));
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: "Check the information you entered." }, 400);
    return json({ error: "Could not sign in. Try again." }, 503);
  }
}
