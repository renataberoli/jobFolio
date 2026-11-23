import Tracker from "./tracker";
import { requireAppUser } from "./profile-auth";
export const dynamic = "force-dynamic";
export default async function Home() {
 const profile = await requireAppUser();
 return <Tracker key={profile.userId} profileName={profile.name} />;
}
