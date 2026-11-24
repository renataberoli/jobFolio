import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { applications } from "../../../../db/schema";
import { getAppUser } from "../../../profile-auth";
import { applicationCsv } from "../../../../lib/application-csv";

export async function GET() {
  try {
    const user = await getAppUser();
    if (!user) return Response.json({ error: "Choose a profile to continue." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    const entries = await getDb().select().from(applications).where(eq(applications.owner, user.userId)).orderBy(desc(applications.createdAt));
    return new Response(applicationCsv(user.name, entries), { headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="jobfolio-applications.csv"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return Response.json({ error: "Could not export your applications. Try again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
