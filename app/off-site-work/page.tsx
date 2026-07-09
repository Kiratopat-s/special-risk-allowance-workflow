import { redirect } from "next/navigation";

export default async function OffSiteWorkPage() {
  redirect("/dashboard?tab=off-site-work");
}
