import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getMonthlyRequestRecheckOffSiteWorkDetail } from "@/app/actions/monthly-request-recheck";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RecheckDetailClient } from "./recheck-detail-client";

interface PageProps {
  params: Promise<{ offSiteWorkId: string }>;
  searchParams: Promise<{ month?: string; departmentId?: string }>;
}

function currentBangkokMonth(): string {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function MonthlyRequestRecheckDetailPage({
  params,
  searchParams,
}: PageProps) {
  const [{ offSiteWorkId }, query] = await Promise.all([params, searchParams]);
  const month = /^\d{4}-\d{2}$/.test(query.month ?? "")
    ? query.month!
    : currentBangkokMonth();
  const departmentId = query.departmentId || undefined;
  const result = await getMonthlyRequestRecheckOffSiteWorkDetail(
    offSiteWorkId,
    month,
    departmentId,
  );
  const backQuery = new URLSearchParams({ month });
  if (departmentId) backQuery.set("departmentId", departmentId);

  if (!result.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ไม่สามารถเปิดข้อมูลใบนำตัวได้</CardTitle>
          <CardDescription>{result.error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href={`/monthly-request-recheck?${backQuery}`}>
              <ArrowLeft className="size-4" /> กลับหน้าตรวจเทียบ
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <RecheckDetailClient
      initialData={result.data}
      departmentId={departmentId}
    />
  );
}
