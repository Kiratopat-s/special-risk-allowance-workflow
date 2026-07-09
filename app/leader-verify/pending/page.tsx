import { redirect } from "next/navigation";

export default async function PendingVerificationsPage() {
  redirect("/dashboard?tab=leader-queue");
}
