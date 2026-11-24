import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../db";
import { applications, profiles } from "../../../db/schema";
import { getAppUser, sameOrigin, sessionHeader } from "../../profile-auth";

const json = (body: unknown, status = 200, cookie?: string) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) },
});

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Request not allowed." }, 403);
  try {
    const user = await getAppUser();
    if (!user) return json({ error: "Choose a profile to continue." }, 401);
    const { name } = z.object({ name: z.string().trim().min(1).max(60) }).parse(await request.json());
    const [profile] = await getDb().update(profiles).set({ name }).where(eq(profiles.id, user.userId)).returning({ name: profiles.name });
    if (!profile) return json({ error: "Profile not found." }, 404);
    return json({ name: profile.name });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: "Enter a username between 1 and 60 characters." }, 400);
    return json({ error: "Could not save your username. Try again." }, 503);
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Request not allowed." }, 403);
  try {
    const user = await getAppUser();
    if (!user) return json({ error: "Choose a profile to continue." }, 401);
    z.object({ confirmation: z.literal("delete") }).parse(await request.json());
    const db = getDb();
    const entries = await db.select({ cvKey: applications.cvKey, letterKey: applications.letterKey }).from(applications).where(eq(applications.owner, user.userId));
    const keys = [...new Set(entries.flatMap(entry => [entry.cvKey, entry.letterKey]).filter(Boolean))];
    if (keys.length && !env.BUCKET) throw new Error("Document storage unavailable");
    for (let offset = 0; offset < keys.length; offset += 1000) {
      await env.BUCKET!.delete(keys.slice(offset, offset + 1000));
    }
    const cookie = await sessionHeader(request, { expires: null });
    await db.batch([
      db.delete(applications).where(eq(applications.owner, user.userId)),
      db.delete(profiles).where(eq(profiles.id, user.userId)),
    ]);
    return json({ next: "/profiles" }, 200, cookie);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: "Confirm profile deletion to continue." }, 400);
    return json({ error: "Could not finish deleting your profile. Try again." }, 503);
  }
}
