import { auth } from "@/lib/auth";
import { monthlyRequestCollectionService } from "@/lib/domains/monthly-request-collection";
import { buildMrcSummaryXlsx } from "@/lib/domains/monthly-request-collection/export";
import { toMonthInput } from "@/lib/shared/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.dbUserId;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await monthlyRequestCollectionService.getSummaryPrintData(id, userId);
  if (!result.success) {
    return Response.json(
      { error: result.error },
      {
        status:
          result.code === "MRC_NOT_FOUND"
            ? 404
            : result.code === "PERMISSION_DENIED"
              ? 403
              : 500,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  const buffer = await buildMrcSummaryXlsx(result.data);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="mrc-${toMonthInput(result.data.collectForMonth)}.xlsx"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
