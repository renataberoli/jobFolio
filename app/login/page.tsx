import { redirect } from "next/navigation";
import { getPinSession } from "../profile-auth";
import { PinLogin } from "../../components/profile-access";
export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in · Jobfolio" };
export default async function LoginPage() {
 const session = await getPinSession();
 if (session) redirect(session.profileId ? "/" : "/profiles");
 return <PinLogin />;
}
