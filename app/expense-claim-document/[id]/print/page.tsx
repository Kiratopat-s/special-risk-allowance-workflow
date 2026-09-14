import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { expenseClaimDocumentService } from "@/lib/domains/expense-claim-document";
import { ClaimPrintPreview } from "@/components/claim-print/claim-print-preview";

export const metadata = { title: "ตัวอย่างใบคำขอเบิกเงินเพิ่มพิเศษ" };

export default async function ClaimPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.dbUserId) redirect("/api/auth/signin");
  const { id } = await params;
  const result = await expenseClaimDocumentService.getPrintData(id, session.user.dbUserId);
  if (!result.success) {
    if (result.code === "CLAIM_NOT_FOUND") notFound();
    if (result.code === "PERMISSION_DENIED") redirect("/");
    throw new Error(result.error);
  }
  return <ClaimPrintPreview documents={[result.data]} title="ตัวอย่างใบคำขอเบิกเงินเพิ่มพิเศษ" />;
}
