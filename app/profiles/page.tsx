import { redirect } from "next/navigation";
import { getPinSession } from "../profile-auth";
import { ProfilePicker } from "../../components/profile-access";
export const dynamic = "force-dynamic";
export const metadata = { title: "Choose a profile · Jobfolio" };
export default async function ProfilesPage() {
 if (!(await getPinSession())) redirect("/login");
 return <ProfilePicker />;
}
