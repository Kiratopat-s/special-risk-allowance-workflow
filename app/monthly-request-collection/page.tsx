import { redirect } from "next/navigation";

export default async function MrcPage() {
  redirect("/dashboard?tab=monthly-requests");
}
