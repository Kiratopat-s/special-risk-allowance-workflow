/**
 * Public leader-verification page
 *
 * Reached via `/leader-verify?token=<uuid>` (no login required).
 * Internal users who follow a link here will also see this page,
 * but they can additionally use the internal /leader-verify flow
 * from their dashboard.
 */

import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getMyActiveSignatureDataUrl } from "@/app/actions/leader-verify";
import { LeaderVerifyClient } from "./leader-verify-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "ยืนยันการออกปฏิบัติงานนอกสถานที่",
  robots: { index: false },
};

export default async function LeaderVerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [resolvedParams, session] = await Promise.all([searchParams, auth()]);

  const token =
    typeof resolvedParams.token === "string" ? resolvedParams.token : null;

  const isLoggedIn = !!session?.user?.dbUserId;

  // Pre-fetch existing signature for logged-in users so they can reuse it
  let existingSignatureDataUrl: string | null = null;
  if (isLoggedIn) {
    const sigResult = await getMyActiveSignatureDataUrl();
    existingSignatureDataUrl = sigResult.success ? sigResult.data : null;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-white dark:from-sky-950 dark:to-background p-4">
      <div className="w-full max-w-lg space-y-4">
        {isLoggedIn && (
          <div className="rounded-xl border bg-card/80 px-4 py-3 text-sm text-muted-foreground flex items-center justify-between gap-3 shadow-sm">
            <span>คุณล็อกอินอยู่แล้ว — ดูคิวยืนยันทั้งหมดของคุณได้ที่:</span>
            <Link
              href="/dashboard?tab=leader-queue"
              className="shrink-0 font-medium text-sky-600 dark:text-sky-400 hover:underline"
            >
              คิวยืนยัน →
            </Link>
          </div>
        )}
        <Suspense
          fallback={
            <div
              aria-busy="true"
              className="space-y-4 rounded-xl border bg-card p-6 shadow-sm"
            >
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          }
        >
          <LeaderVerifyClient
            token={token}
            existingSignatureDataUrl={existingSignatureDataUrl}
          />
        </Suspense>
      </div>
    </main>
  );
}
