import { getPinSession } from "../../profile-auth";
import { getDb } from "../../../db";
import { profiles } from "../../../db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  if (!(await getPinSession())) return Response.json({ error: "Enter the PIN to continue." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const items = await getDb().select({ id: profiles.id, name: profiles.name }).from(profiles).orderBy(asc(profiles.createdAt), asc(profiles.id));
    return Response.json({ profiles: items }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not load profiles." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
