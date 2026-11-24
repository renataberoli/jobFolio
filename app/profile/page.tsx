import { requireAppUser } from "../profile-auth";
import ProfileSettings from "../../components/profile-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your profile · Jobfolio" };

export default async function ProfilePage() {
  const user = await requireAppUser();
  return <ProfileSettings initialName={user.name}/>;
}
