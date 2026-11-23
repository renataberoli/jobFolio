import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "../db";
import { profiles } from "../db/schema";
import { eq } from "drizzle-orm";
import { signSession, verifySession, type PinSession } from "../lib/pin-session";

export const sessionCookie = "jobfolio_session";

export function authConfig() {
  if (!env.JOBFOLIO_SESSION_SECRET || !env.JOBFOLIO_PIN_HASH) {
    throw new Error("Access unavailable. Try again shortly.");
  }
  return { secret: env.JOBFOLIO_SESSION_SECRET, pinHash: env.JOBFOLIO_PIN_HASH };
}

export async function getPinSession(): Promise<PinSession | null> {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;
  return verifySession(token, authConfig().secret);
}

export async function sessionHeader(request: Request, session: PinSession | null) {
  const token = session ? await signSession({ ...session, expires: null }, authConfig().secret) : "";
  const age = session ? 400 * 24 * 60 * 60 : 0;
  return `${sessionCookie}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}

export async function getAppUser() {
  const session = await getPinSession();
  if (!session?.profileId) return null;
  const [profile] = await getDb().select().from(profiles).where(eq(profiles.id, session.profileId));
  return profile ? { userId: profile.id, name: profile.name } : null;
}

export async function requireAppUser() {
  if (!(await getPinSession())) redirect("/login");
  const user = await getAppUser();
  if (!user) redirect("/profiles");
  return user;
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return request.headers.get("sec-fetch-site") !== "cross-site" && (!origin || origin === new URL(request.url).origin);
}
