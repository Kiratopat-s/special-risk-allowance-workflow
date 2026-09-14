import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { monthlyRequestCollectionService } from "@/lib/domains/monthly-request-collection";
import { ClaimPrintPreview } from "@/components/claim-print/claim-print-preview";

export const metadata = { title: "ตัวอย่างใบคำขอเบิกทั้งชุดรายเดือน" };

export default async function CollectionClaimsPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.dbUserId) redirect("/api/auth/signin");
  const { id } = await params;
  const result = await monthlyRequestCollectionService.getClaimsPrintData(id, session.user.dbUserId);
  if (!result.success) {
    if (result.code === "MRC_NOT_FOUND") notFound();
    if (result.code === "PERMISSION_DENIED") redirect("/");
    throw new Error(result.error);
  }
  return <ClaimPrintPreview documents={result.data} title="ตัวอย่างใบคำขอเบิกทั้งชุดรายเดือน" />;
}
