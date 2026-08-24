import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import {
  monthlyRequestCollectionService,
  type MonthlyRequestCollectionWithRelations,
} from "@/lib/domains/monthly-request-collection";
import {
  dateDisplay,
  longDateDisplay,
  moneyDisplay,
  monthDisplay,
} from "@/lib/shared/format";
import { PrintPageControls } from "../print-client";

interface PrintPageProps {
  params: Promise<{ id: string }>;
}

interface PrintPageChunk<T> {
  rows: T[];
  offset: number;
  isLast: boolean;
}

export function paginate<T>(
  rows: T[],
  regularSize: number,
  finalSize: number,
): PrintPageChunk<T>[] {
  if (rows.length <= finalSize) return [{ rows, offset: 0, isLast: true }];

  const pageCount =
    Math.ceil((rows.length - finalSize) / regularSize) + 1;
  const regularPageCount = pageCount - 1;
  const finalRowCount = Math.min(
    finalSize,
    Math.ceil(rows.length / pageCount),
  );
  const regularRowCount = rows.length - finalRowCount;
  const pages: PrintPageChunk<T>[] = [];
  let offset = 0;
  for (let pageIndex = 0; pageIndex < regularPageCount; pageIndex += 1) {
    const remainingRows = regularRowCount - offset;
    const remainingPages = regularPageCount - pageIndex;
    const take = Math.ceil(remainingRows / remainingPages);
    pages.push({ rows: rows.slice(offset, offset + take), offset, isLast: false });
    offset += take;
  }
  pages.push({ rows: rows.slice(offset), offset, isLast: true });
  return pages;
}

function thaiWeekday(value: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "short",
    timeZone: "UTC",
  }).format(value);
}

export const metadata = { title: "บัญชีสรุปค่าตอบแทนเสี่ยงภัยพิเศษ" };
export const dynamic = "force-dynamic";

export default async function MrcPrintPage({ params }: PrintPageProps) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.dbUserId;
  if (!userId) redirect("/api/auth/signin");

  const result = await monthlyRequestCollectionService.getById(id);
  if (!result.success) notFound();
  const mrc = result.data;
  if (mrc.status === "CANCELLED") notFound();
  const allowed = await can(userId, "MONTHLY_REQUEST", "PRINT", {
    departmentId: mrc.departmentId,
    targetOwnerId: mrc.collectorId,
  });
  if (!allowed) redirect("/");
  await monthlyRequestCollectionService.recordPrintRendered(id, userId);

  return <MrcPrintDocument mrc={mrc} printedAt={new Date()} />;
}

export function MrcPrintDocument({
  mrc,
  printedAt,
}: {
  mrc: MonthlyRequestCollectionWithRelations;
  printedAt: Date;
}) {
  const items = [...mrc.items].sort(
    (a, b) => (a.rowNo ?? Number.MAX_SAFE_INTEGER) - (b.rowNo ?? Number.MAX_SAFE_INTEGER),
  );
  const departmentName =
    items[0]?.departmentNameSnapshot ?? mrc.department.name;
  const pages = paginate(items, 19, 11);
  const printedAtText = longDateDisplay(printedAt);
  const titleMonth = monthDisplay(mrc.collectForMonth);
  const watermark =
    mrc.status === "DRAFT"
      ? "ฉบับร่าง · ใช้ตรวจสอบเท่านั้น"
      : mrc.status === "VOIDED"
        ? "ยกเลิก · ห้ามใช้เบิกจ่าย"
        : null;
  const appendixRows = items.flatMap((item) =>
    item.dates.map((date) => ({
      item,
      date,
      codes: date.weSafeCodes.map((code) => code.code).join(", ") || "—",
    })),
  );
  const appendixPages = paginate(appendixRows, 22, 22);
  const totalPages = pages.length + appendixPages.length;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
@font-face { font-family: 'THSarabun'; src: url('/font/THSarabun.ttf') format('truetype'); font-weight: normal; }
@font-face { font-family: 'THSarabun'; src: url('/font/THSarabun Bold.ttf') format('truetype'); font-weight: bold; }
@page { size: A4 portrait; margin: 12mm 13mm 14mm; }
*, *::before, *::after { box-sizing: border-box; }
header, nav, footer { display: none !important; }
main { flex: unset !important; }
html, body { margin: 0; padding: 0; color: #000; background: #fff; font-family: 'THSarabun', 'Sarabun', sans-serif; font-size: 16px; line-height: 1.25; }
.print-page { max-width: 210mm; margin: 0 auto; padding: 14mm; }
.sheet { position: relative; min-height: 268mm; display: flex; flex-direction: column; overflow: hidden; background: #fff; }
.sheet + .sheet { margin-top: 16px; }
.no-print { display: flex; justify-content: flex-end; margin-bottom: 12px; }
.watermark { position: absolute; inset: 42% auto auto 50%; transform: translate(-50%, -50%) rotate(-30deg); z-index: 4; width: 130%; text-align: center; font-size: 54px; font-weight: bold; color: rgba(185, 28, 28, .16); pointer-events: none; white-space: nowrap; }
.head { display: grid; grid-template-columns: 72px 1fr 72px; align-items: center; gap: 8px; }
.logo { width: 68px; height: 68px; object-fit: contain; }
.title { text-align: center; font-size: 23px; font-weight: bold; }
.subtitle { text-align: center; font-size: 18px; }
.status { text-align: right; font-weight: bold; font-size: 14px; }
.meta { display: flex; justify-content: space-between; gap: 10px; margin: 7px 0 9px; font-size: 14px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th, td { border: 1px solid #000; padding: 3px 5px; vertical-align: middle; }
th { background: #eee; text-align: center; font-weight: bold; }
.center { text-align: center; } .right { text-align: right; }
.total td { background: #eee; font-weight: bold; }
.dates { font-size: 12px; line-height: 1.2; }
.signature { width: 58%; margin: 31px 0 0 auto; text-align: center; break-inside: avoid; page-break-inside: avoid; font-size: 16px; }
.signature p { margin: 7px 0; }
.blank { display: inline-block; min-width: 210px; border-bottom: 1px dotted #000; height: 20px; vertical-align: bottom; }
.footer { margin-top: auto; border-top: 1px solid #999; padding-top: 5px; display: flex; justify-content: space-between; gap: 12px; font-size: 11px; color: #444; overflow-wrap: anywhere; }
.appendix-title { margin: 8px 0 10px; text-align: center; font-size: 20px; font-weight: bold; }
@media print {
  .no-print { display: none !important; }
  .print-page { width: 100%; max-width: none; margin: 0; padding: 0; }
  .sheet { min-height: 265mm; break-after: page; page-break-after: always; }
  .sheet:last-child { break-after: auto; page-break-after: auto; }
  .sheet + .sheet { margin-top: 0; }
}
          `,
        }}
      />
      <div className="print-page" lang="th">
        <PrintPageControls />
        {pages.map((page, pageIndex) => (
          <section className="sheet" key={`summary-${pageIndex}`}>
            {watermark && <div className="watermark">{watermark}</div>}
            <div className="head">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="logo" src="/logo/pea_logo_big.png" alt="PEA" />
              <div>
                <div className="title">บัญชีสรุปค่าตอบแทนเสี่ยงภัยพิเศษ</div>
                <div className="subtitle">
                  ประจำเดือน {titleMonth} · {departmentName}
                </div>
              </div>
              <div className="status">
                {mrc.batchNo ? `ชุดที่ ${mrc.batchNo}` : "DRAFT"}
              </div>
            </div>
            <div className="meta">
              <span>MRC: {mrc.id}</span>
              <span>หน้า {pageIndex + 1}/{totalPages}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "5%" }}>ลำดับ</th>
                  <th style={{ width: "11%" }}>รหัส</th>
                  <th style={{ width: "23%" }}>ชื่อ-นามสกุล</th>
                  <th style={{ width: "17%" }}>ตำแหน่ง/ระดับ</th>
                  <th style={{ width: "20%" }}>วันที่ปฏิบัติงาน</th>
                  <th style={{ width: "8%" }}>วัน</th>
                  <th style={{ width: "12%" }}>จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((item, index) => (
                  <tr key={item.id}>
                    <td className="center">{page.offset + index + 1}</td>
                    <td className="center">{item.employeeIdSnapshot || "-"}</td>
                    <td>{item.firstNameSnapshot} {item.lastNameSnapshot}</td>
                    <td>
                      {item.positionShortSnapshot}
                      {item.positionLevelSnapshot ? ` ${item.positionLevelSnapshot}` : ""}
                    </td>
                    <td className="dates">
                      {item.dates.map((date) => `${date.workDate.getUTCDate()} ${thaiWeekday(date.workDate)}`).join(", ")}
                    </td>
                    <td className="center">{item.dayCountSnapshot}</td>
                    <td className="right">{moneyDisplay(item.amountSnapshot)}</td>
                  </tr>
                ))}
                {page.isLast && (
                  <tr className="total">
                    <td colSpan={5} className="center">รวมทั้งสิ้น {mrc.claimCount} คำขอ</td>
                    <td className="center">{mrc.countDates}</td>
                    <td className="right">{moneyDisplay(mrc.amount)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {page.isLast && (
              <div className="signature">
                <p>ลงชื่อ <span className="blank" /> หผ.</p>
                <p>(ชื่อ-นามสกุล/ประทับชื่อ <span className="blank" />)</p>
                <p>วันที่ <span className="blank" /></p>
              </div>
            )}
            <div className="footer">
              <span>MRC: {mrc.id} · Snapshot v{mrc.snapshotVersion}: {mrc.snapshotHash ?? "DRAFT"}</span>
              <span>พิมพ์เมื่อ {printedAtText}</span>
            </div>
          </section>
        ))}

        {appendixPages.map((appendixPage, appendixPageIndex) => (
          <section className="sheet" key={`appendix-${appendixPageIndex}`}>
            {watermark && <div className="watermark">{watermark}</div>}
            <div className="appendix-title">ภาคผนวกวันปฏิบัติงานและเลขรหัส WeSafe · {titleMonth}</div>
            <div className="meta">
              <span>{departmentName} · ชุดที่ {mrc.batchNo ?? "DRAFT"}</span>
              <span>หน้า {pages.length + appendixPageIndex + 1}/{totalPages}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "5%" }}>ลำดับ</th>
                  <th style={{ width: "11%" }}>รหัส</th>
                  <th style={{ width: "19%" }}>ชื่อ-นามสกุล</th>
                  <th style={{ width: "14%" }}>วันที่ พ.ศ.</th>
                  <th style={{ width: "8%" }}>งาน</th>
                  <th style={{ width: "16%" }}>ใบนำตัว</th>
                  <th style={{ width: "14%" }}>ผลวันหยุด</th>
                  <th style={{ width: "13%" }}>WeSafe</th>
                </tr>
              </thead>
              <tbody>
                {appendixPage.rows.map(({ item, date, codes }, index) => (
                  <tr key={`${item.id}-${date.id}`}>
                    <td className="center">{appendixPage.offset + index + 1}</td>
                    <td className="center">{item.employeeIdSnapshot || "-"}</td>
                    <td>{item.firstNameSnapshot} {item.lastNameSnapshot}</td>
                    <td className="center">{dateDisplay(date.workDate)} ({thaiWeekday(date.workDate)})</td>
                    <td className="center">{date.dayType}</td>
                    <td>{date.offSiteWorkRefSnapshot || date.offSiteWorkIdSnapshot}</td>
                    <td>{date.holidayType}{date.holidayName ? ` · ${date.holidayName}` : ""}</td>
                    <td>{codes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="footer">
              <span>MRC: {mrc.id} · Snapshot: {mrc.snapshotHash ?? "DRAFT"}</span>
              <span>พิมพ์เมื่อ {printedAtText}</span>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
