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

  if (!error && session?.user?.dbUserId) {
    redirect(callbackUrl);
  }

  return (
    <div className="container mx-auto grid min-h-[calc(100vh-8rem)] max-w-5xl items-center gap-0 px-5 py-12 lg:grid-cols-2">
      <aside className="bg-[#202535] text-white rounded-t-2xl lg:rounded-l-2xl lg:rounded-tr-none p-8 sm:p-12 lg:min-h-[430px] flex flex-col justify-center"><span className="brand-mark mb-9">s.</span><p className="text-[10px] text-white/50 tracking-[.18em] mb-4">SPECIAL RISK ALLOWANCE WORKFLOW</p><h1 className="text-3xl font-bold leading-relaxed">พื้นที่ทำงานของคุณ<br />พร้อมให้เริ่มต้น</h1><p className="text-sm text-white/60 leading-7 mt-5">จัดเตรียมเอกสาร ติดตามสถานะ และทำงานร่วมกันผ่านบัญชีองค์กร</p></aside>
      <Card className="w-full rounded-t-none lg:rounded-r-2xl lg:rounded-l-none lg:min-h-[430px] justify-center py-8">
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
