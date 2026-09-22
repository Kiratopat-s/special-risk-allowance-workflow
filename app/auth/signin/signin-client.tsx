"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { ArrowLeft, LogIn } from "lucide-react";

import { LoadingButton } from "@/components/workflow-ui/loading-button";
import { Button } from "@/components/workflow-ui/button";
import { EMPLOYEE_ID_ALREADY_LINKED, EMPLOYEE_ID_ALREADY_LINKED_MESSAGE } from "@/lib/domains/user/errors";

interface SignInClientProps {
  callbackUrl: string;
  error?: string | null;
}

export function SignInClient({ callbackUrl, error }: SignInClientProps) {
  const [isPending, setIsPending] = useState(false);
  const employeeIdConflict = error === EMPLOYEE_ID_ALREADY_LINKED;

  const handleSignIn = () => {
    setIsPending(true);
    // Let the user switch accounts instead of reusing the rejected Keycloak SSO session.
    void signIn("keycloak", { callbackUrl }, employeeIdConflict ? { prompt: "login" } : undefined);
  };

  return (
    <div className="space-y-5">
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
          {employeeIdConflict
            ? EMPLOYEE_ID_ALREADY_LINKED_MESSAGE
            : error === "AccessDenied"
            ? "ไม่สามารถเตรียมข้อมูลบัญชีเพื่อเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง หากยังพบปัญหาให้ติดต่อผู้ดูแลระบบ"
            : "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง"}
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
