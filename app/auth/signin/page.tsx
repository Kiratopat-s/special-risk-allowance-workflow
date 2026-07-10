import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { SignInClient } from "./signin-client";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ | Special Risk Allowance Workflow",
  description: "Sign in to the Special Risk Allowance Workflow system.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string): string | null {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeCallbackUrl(value: string | null): string {
  if (!value) return "/dashboard";

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}${url.hash}` || "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const callbackUrl = normalizeCallbackUrl(getParam(params, "callbackUrl"));
  const error = getParam(params, "error");
  const session = await auth();

  if (session?.user?.dbUserId) {
    redirect(callbackUrl);
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4 py-12">
      <Card className="w-full">
        <CardHeader className="space-y-4">
          <Badge variant="outline" className="w-fit gap-2 rounded-full">
            <KeyRound className="h-3.5 w-3.5" />
            Authentication
          </Badge>
          <div className="space-y-2">
            <CardTitle className="text-2xl">เข้าสู่ระบบ</CardTitle>
            <CardDescription className="leading-6">
              กรุณาเข้าสู่ระบบด้วยบัญชีองค์กร เพื่อไปยังหน้า Dashboard
              และใช้งาน Special Risk Allowance Workflow
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <SignInClient callbackUrl={callbackUrl} error={error} />
        </CardContent>
      </Card>
    </div>
  );
}
