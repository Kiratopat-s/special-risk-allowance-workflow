/**
 * Internal Leader Pending Verification Queue
 *
 * Authenticated page — shows all expense claims waiting for the
 * currently logged-in user's verification as a leader.
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import {
  listMyPendingVerifications,
  getMyActiveSignatureDataUrl,
} from "@/app/actions/leader-verify";
import { PendingVerificationsClient } from "./pending-client";

export const metadata: Metadata = {
  title: "คิวยืนยันการออกปฏิบัติงาน",
};

export default async function PendingVerificationsPage() {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    redirect("/api/auth/signin");
  }

  const [result, sigResult] = await Promise.all([
    listMyPendingVerifications(),
    getMyActiveSignatureDataUrl(),
  ]);
  const items = result.success ? result.data : [];
  const existingSignatureDataUrl = sigResult.success ? sigResult.data : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 to-white dark:from-sky-950 dark:to-background p-4 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <PendingVerificationsClient
          initialItems={items}
          existingSignatureDataUrl={existingSignatureDataUrl}
        />
      </div>
    </main>
  );
}
