import { redirect } from "next/navigation";

export default async function SignaturePage() {
  redirect("/dashboard?tab=signature");
}
