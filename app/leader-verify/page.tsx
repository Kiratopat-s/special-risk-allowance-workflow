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
    <section className="flex min-h-[70vh] items-start justify-center px-4 py-12 sm:py-16">
      <div className="w-full max-w-2xl space-y-5">
        <div className="rounded-2xl bg-[#202535] px-6 py-7 text-white sm:px-8">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-white/60">
            LEADER VERIFICATION
          </p>
          <h1 className="mt-3 text-2xl font-bold">
            ยืนยันการออกปฏิบัติงานนอกสถานที่
          </h1>
        </div>
        {isLoggedIn && (
          <div className="rounded-xl border bg-card/80 px-4 py-3 text-sm text-muted-foreground flex items-center justify-between gap-3 shadow-sm">
            <span>คุณล็อกอินอยู่แล้ว — ดูคิวยืนยันทั้งหมดของคุณได้ที่:</span>
            <Link
              href="/dashboard?tab=leader-queue"
              className="shrink-0 font-medium text-primary hover:underline"
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
    </section>
  );
}
