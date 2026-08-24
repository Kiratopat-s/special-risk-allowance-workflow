import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import { monthlyRequestCollectionService } from "@/lib/domains/monthly-request-collection";
import {
  buildMrcExportFilename,
  writeMrcWorkbookBuffer,
} from "@/lib/exports";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.dbUserId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await monthlyRequestCollectionService.getById(id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  const mrc = result.data;
  const allowed = await can(userId, "MONTHLY_REQUEST", "EXPORT", {
    departmentId: mrc.departmentId,
    targetOwnerId: mrc.collectorId,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }
  if (mrc.status !== "FINALIZED" && mrc.status !== "ALL_DONE") {
    return NextResponse.json(
      { error: "Only finalized monthly requests can be exported" },
      { status: 409 },
    );
  }

  const buffer = await writeMrcWorkbookBuffer(mrc);
  const month = mrc.collectForMonth.toISOString().slice(0, 7);
  const batch = mrc.batchNo ?? 0;
  const filename = buildMrcExportFilename(mrc);
  const asciiFilename = `MRC_${month}_B${batch}.xlsx`;
  await monthlyRequestCollectionService.recordExported(id, userId, {
    filename,
    dataRowCount: mrc.items.length,
    datesRowCount: mrc.items.reduce(
      (count, item) => count + item.dates.length,
      0,
    ),
  });
  return new Response(Uint8Array.from(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
