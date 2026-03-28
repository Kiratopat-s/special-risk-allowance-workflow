/**
 * MRC Print Page — Formal Thai document for Account Department submission
 *
 * Font: THSarabun (place TTF/WOFF2 files in /public/font/)
 * Expected files: THSarabun.ttf (or THSarabunNew.ttf)
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAny } from "@/lib/auth/permissions";
import { monthlyRequestCollectionRepository } from "@/lib/domains/monthly-request-collection";
import { PrintPageControls } from "../print-client";
import { longDateDisplay, monthDisplay } from "@/lib/shared/format";

interface PrintPageProps {
  params: Promise<{ id: string }>;
}

function decimalToNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v);
  if (typeof v === "object" && "toString" in (v as object)) {
    return parseFloat(String((v as { toString(): string }).toString()));
  }
  return 0;
}

function decimalText(v: unknown): string {
  const num = decimalToNumber(v);
  return num === 0 ? "-" : num.toString();
}

/** Convert a reviewer's active signature bytes to a data URL, or null if unavailable. */
function reviewerSigUrl(
  reviewer:
    | { signatures?: Array<{ signatureData: Buffer | Uint8Array }> }
    | null
    | undefined,
): string | null {
  const data = reviewer?.signatures?.[0]?.signatureData;
  if (!data) return null;
  try {
    return `data:image/png;base64,${Buffer.from(data).toString("base64")}`;
  } catch {
    return null;
  }
}

function paginateClaimsForPrint<T>(
  items: T[],
  regularPageRows: number,
  lastPageRows: number,
): Array<{ rows: T[]; rowOffset: number; isLastPage: boolean }> {
  const total = items.length;
  if (total === 0) {
    return [{ rows: [], rowOffset: 0, isLastPage: true }];
  }

  if (total <= lastPageRows) {
    return [
      {
        rows: items,
        rowOffset: 0,
        isLastPage: true,
      },
    ];
  }

  const rowsBeforeLast = total - lastPageRows;
  const prePageCount = Math.ceil(rowsBeforeLast / regularPageRows);
  const baseRows = Math.floor(rowsBeforeLast / prePageCount);
  const extraRows = rowsBeforeLast % prePageCount;

  const pages: Array<{ rows: T[]; rowOffset: number; isLastPage: boolean }> =
    [];
  let cursor = 0;

  for (let page = 0; page < prePageCount; page += 1) {
    const rowsThisPage = baseRows + (page < extraRows ? 1 : 0);
    pages.push({
      rows: items.slice(cursor, cursor + rowsThisPage),
      rowOffset: cursor,
      isLastPage: false,
    });
    cursor += rowsThisPage;
  }

  pages.push({
    rows: items.slice(cursor),
    rowOffset: cursor,
    isLastPage: true,
  });

  return pages;
}

export const metadata = {
  title: "บัญชีสรุปค่าตอบแทนเสี่ยงภัยพิเศษ",
};

export default async function MrcPrintPage({ params }: PrintPageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.dbUserId) redirect("/api/auth/signin");

  const hasAccess = await canAny(session.user.dbUserId, [
    { resource: "MONTHLY_REQUEST", action: "READ" },
    { resource: "MONTHLY_REQUEST", action: "LIST" },
    { resource: "MONTHLY_REQUEST", action: "MANAGE" },
    { resource: "MONTHLY_REQUEST", action: "APPROVE" },
  ]);
  if (!hasAccess) redirect("/");

  const mrc = await monthlyRequestCollectionRepository.findWithRelations(id);
  if (!mrc) notFound();

  const printedDate = longDateDisplay(new Date());
  const forMonth = monthDisplay(mrc.collectForMonth);

  const claims = [...mrc.expenseClaims].sort((a, b) =>
    (a.claimant.employeeId ?? "").localeCompare(b.claimant.employeeId ?? ""),
  );

  const totalDates = claims.reduce(
    (sum, claim) => sum + decimalToNumber(claim.countDates),
    0,
  );
  const totalAmount = claims.reduce(
    (sum, claim) => sum + decimalToNumber(claim.amount),
    0,
  );

  const hpaStep = mrc.approvalSteps.find((s) => s.stage === "HPA_CHECK");
  const rkStep = mrc.approvalSteps.find((s) => s.stage === "RK_CHECK");
  const okStep = mrc.approvalSteps.find((s) => s.stage === "OK_APPROVE");

  const regularPageRows = 22;
  const lastPageRows = 12;
  const claimPages = paginateClaimsForPrint(
    claims,
    regularPageRows,
    lastPageRows,
  );
  const totalPages = claimPages.length;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
@font-face {
  font-family: 'THSarabun';
  src: url('/font/THSarabun.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'THSarabun';
  src: url('/font/THSarabun Bold.ttf') format('truetype');
  font-weight: bold;
  font-style: normal;
}

@page {
  size: A4 portrait;
  margin: 12mm 14mm 20mm 16mm;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

header, nav, footer { display: none !important; }
main { flex: unset !important; }

html, body {
  font-family: 'THSarabun', 'Sarabun', sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: #000;
  background: #fff;
}

.page {
  max-width: 210mm;
  margin: 0 auto;
  padding: 20mm 20mm 15mm 25mm;
}

.print-sheet {
  background: #fff;
  display: flex;
  flex-direction: column;
}

.print-sheet + .print-sheet {
  margin-top: 16px;
}

.no-print { display: flex; justify-content: flex-end; margin-bottom: 12px; gap: 8px; }

.doc-header {
  margin-bottom: 12px;
}

.doc-header-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}

.doc-logo {
  flex-shrink: 0;
  width: 98px;
  height: 98px;
  object-fit: contain;
}

.doc-header-text {
  flex: 1;
}

.doc-title {
  text-align: center;
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 4px;
}

.doc-subtitle {
  text-align: center;
  font-size: 16px;
  margin-bottom: 2px;
}

.doc-meta {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  font-size: 15px;
  margin-bottom: 12px;
}

.doc-page-mark {
  white-space: nowrap;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 8px;
  font-size: 15px;
}

th, td {
  border: 1px solid #000;
  padding: 4px 8px;
  vertical-align: middle;
}

th { background: #f5f5f5; font-weight: bold; text-align: center; }
.col-order { width: 5%; }
.col-employee-id { width: 10%; }
.col-name { width: 25%; }
.col-position { width: 30%; }
.col-days { width: 10%; }
.col-amount { width: 20%; }
td.center { text-align: center; }
td.right { text-align: right; }
tr.total-row td { font-weight: bold; background: #f0f0f0; }

thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }

.sheet-footer {
  margin-top: auto;
  font-size: 13px;
  color: #555;
  border-top: 1px solid #ccc;
  padding-top: 6px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.signatures {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 40px;
  break-inside: avoid;
  page-break-inside: avoid;
}

.sig-block { text-align: center; }

.sig-image {
  display: block;
  margin: 8px auto 0;
  max-width: 120px;
  max-height: 56px;
  object-fit: contain;
}
.sig-placeholder { height: 64px; }

.sig-line {
  border-bottom: 1px solid #000;
  margin: 4px 12px 4px;
}

.sig-label { font-size: 14px; }
.sig-name { font-size: 15px; }
.sig-role { font-size: 14px; color: #444; }
.sig-date { font-size: 13px; color: #666; }
.sig-status { font-size: 13px; margin-top: 2px; }
.sig-status-approved { color: #166534; }
.sig-remark { font-size: 13px; color: #c00; margin-top: 2px; font-style: italic; }

.footer-note {
  margin-top: 12px;
  font-size: 13px;
  color: #555;
  border-top: 1px solid #ccc;
  padding-top: 8px;
  break-inside: avoid;
  page-break-inside: avoid;
}

button {
  font-family: 'THSarabun', 'Sarabun', sans-serif;
  font-size: 15px;
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid #888;
  cursor: pointer;
  background: #fff;
}

button.primary {
  background: #1a56db;
  color: #fff;
  border-color: #1a56db;
}

@media print {
  .no-print { display: none !important; }
  .page {
    width: 100%;
    max-width: 100%;
    margin: 0;
    padding: 0;
  }
  .print-sheet {
    break-after: page;
    page-break-after: always;
    min-height: calc(297mm - 32mm);
  }
  .print-sheet:last-child {
    break-after: auto;
    page-break-after: auto;
  }
  .print-sheet + .print-sheet {
    margin-top: 0;
  }
  html, body {
    font-size: 14px;
  }
}
            `,
        }}
      />
      <div className="page" lang="th">
        <PrintPageControls />

        {claimPages.map((claimPage, pageIndex) => {
          return (
            <section
              key={`print-page-${pageIndex + 1}`}
              className="print-sheet"
            >
              <div className="doc-header">
                <div className="doc-header-top">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo/pea_logo_big.png"
                    alt="PEA Logo"
                    className="doc-logo"
                  />
                  <div className="doc-header-text">
                    <p className="doc-title">สรุปรายการเบิกเสี่ยงภัยพิเศษ</p>
                    <p className="doc-subtitle">{`ประจำ เดือน ${forMonth}`}</p>
                  </div>
                </div>
                <div className="doc-meta">
                  <span>{`วันที่พิมพ์: ${printedDate}`}</span>
                  <span className="doc-page-mark">
                    {`หน้าที่ ${pageIndex + 1}/${totalPages}`}
                  </span>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th className="col-order">ลำดับ</th>
                    <th className="col-employee-id">รหัสพนักงาน</th>
                    <th className="col-name">ชื่อ-สกุล</th>
                    <th className="col-position">ตำแหน่ง/สังกัด</th>
                    <th className="col-days">จำนวนวัน</th>
                    <th className="col-amount">จำนวนเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  {claimPage.rows.map((claim, idx) => (
                    <tr key={claim.id}>
                      <td className="center">
                        {claimPage.rowOffset + idx + 1}
                      </td>
                      <td className="center">
                        {claim.claimant.employeeId ?? "-"}
                      </td>
                      <td>
                        {claim.claimant.firstName} {claim.claimant.lastName}
                      </td>
                      <td>
                        {claim.claimantPositionAtSubmission}
                        {claim.claimant.department?.shortName
                          ? ` / ${claim.claimant.department.shortName}`
                          : ""}
                      </td>
                      <td className="center">
                        {decimalText(claim.countDates)}
                      </td>
                      <td className="right">
                        {decimalToNumber(claim.amount) > 0
                          ? decimalToNumber(claim.amount).toLocaleString(
                              "th-TH",
                              {
                                minimumFractionDigits: 2,
                              },
                            )
                          : "-"}
                      </td>
                    </tr>
                  ))}
                  {claimPage.isLastPage && (
                    <tr className="total-row">
                      <td className="center" colSpan={4}>
                        รวมทั้งสิ้น
                      </td>
                      <td className="center">{totalDates}</td>
                      <td className="right">
                        {totalAmount.toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {claimPage.isLastPage && (
                <>
                  <div className="signatures">
                    {[hpaStep, rkStep, okStep].map((step, i) => {
                      const labels = [
                        "หผ. ตรวจสอบ",
                        "รก. ตรวจสอบ",
                        "อก. อนุมัติ",
                      ];
                      const sigUrl =
                        step?.status === "APPROVED"
                          ? reviewerSigUrl(step?.reviewer)
                          : null;
                      return (
                        <div key={i} className="sig-block">
                          {sigUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={sigUrl}
                              alt="ลายเซ็น"
                              className="sig-image"
                            />
                          ) : (
                            <div className="sig-placeholder" />
                          )}
                          <div className="sig-line" />
                          <p className="sig-label">{labels[i]}</p>
                          {step?.reviewer ? (
                            <>
                              <p className="sig-name">
                                ({step.reviewer.firstName}{" "}
                                {step.reviewer.lastName})
                              </p>
                              <p className="sig-role">
                                {step.reviewer.positionShort ?? ""}
                                {step.reviewer.positionLevel
                                  ? ` ${step.reviewer.positionLevel}`
                                  : ""}
                              </p>
                              <p className="sig-date">
                                {step.reviewedAt
                                  ? longDateDisplay(step.reviewedAt)
                                  : ""}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="sig-name">(……………………………)</p>
                              <p className="sig-role">&nbsp;</p>
                              <p className="sig-date">&nbsp;</p>
                            </>
                          )}
                          {step?.status === "REJECTED" && step.remark && (
                            <p className="sig-remark">ปฏิเสธ: {step.remark}</p>
                          )}
                          {step?.status === "APPROVED" && (
                            <p className="sig-status sig-status-approved">
                              ✓ อนุมัติ
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="sheet-footer">
                <span>{`MRC ID: ${mrc.id}`}</span>
                <span>{`เอกสารนี้จัดทำโดยระบบ Special Risk Allowance Workflow · พิมพ์เมื่อ ${printedDate}`}</span>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
