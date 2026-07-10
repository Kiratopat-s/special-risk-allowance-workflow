"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { ArrowLeft, LogIn } from "lucide-react";

import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";

interface SignInClientProps {
  callbackUrl: string;
  error?: string | null;
}

export function SignInClient({ callbackUrl, error }: SignInClientProps) {
  const [isPending, setIsPending] = useState(false);

  const handleSignIn = () => {
    setIsPending(true);
    void signIn("keycloak", { callbackUrl });
  };

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
          ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง
        </div>
      ) : null}

      <LoadingButton
        className="w-full"
        isLoading={isPending}
        loadingText="กำลังไปยังหน้าเข้าสู่ระบบ"
        onClick={handleSignIn}
      >
        <LogIn className="h-4 w-4" />
        เข้าสู่ระบบด้วย Keycloak
      </LoadingButton>

      <Button variant="ghost" className="w-full" asChild>
        <Link href="/">
          <ArrowLeft className="h-4 w-4" />
          กลับหน้าแรก
        </Link>
      </Button>
    </div>
  );
}
