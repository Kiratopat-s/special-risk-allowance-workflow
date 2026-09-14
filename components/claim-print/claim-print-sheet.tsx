/* eslint-disable @next/next/no-img-element -- Print uses original images and waits for decoding. */
import type { ClaimPrintDocument } from "@/lib/shared/types/claim-print";
import type { ClaimPrintPage } from "@/lib/ui/claim-print-pagination";

interface Props {
  document: ClaimPrintDocument;
  page: ClaimPrintPage;
  pageNumber: number;
  totalPages: number;
  measurement?: boolean;
}

export function ClaimPrintSheet({ document: doc, page, pageNumber, totalPages, measurement }: Props) {
  return (
    <article className="claim-print-sheet" data-claim-id={doc.id} lang="th">
      <div data-sheet-content>
      <div data-sheet-heading>
        <div className="claim-form-header">
          <div className="claim-form-logo"><img src="/logo/pea_logo_big.png" alt="ตราการไฟฟ้าส่วนภูมิภาค" /><strong>การไฟฟ้าส่วนภูมิภาค</strong><small>PROVINCIAL ELECTRICITY AUTHORITY</small></div>
          <div className="claim-form-title">
            <h1>รายงานการปฏิบัติงานด้านฮอทไลน์ (เบิกเงินเพิ่มพิเศษ)</h1>
            <p>ประจำเดือน <span>{doc.monthName}</span> พ.ศ. <span>{doc.buddhistYear}</span></p>
          </div>
        </div>
        <div className="claim-form-person">
          <p>ชื่อ <span>{doc.claimantName}</span></p>
          <p>รหัสพนักงาน <span>{doc.employeeId}</span></p>
          <p>ตำแหน่ง <span>{doc.claimantPosition}</span></p>
        </div>
        <table className="claim-form-calendar" aria-label="วันที่เบิก">
          <colgroup><col span={31} /><col className="claim-form-total" /></colgroup>
          <tbody>
            <tr><th colSpan={31}>วันที่</th><th>รวม (วัน)</th></tr>
            <tr>{Array.from({ length: 31 }, (_, i) => <td key={i}>{i + 1}</td>)}<td rowSpan={2} className="claim-day-total">{doc.countDates}</td></tr>
            <tr>{Array.from({ length: 31 }, (_, i) => {
              const day = i + 1;
              return <td key={day} className={`claim-day-mark${day > doc.daysInMonth ? " claim-day-unavailable" : ""}`}>
                {doc.selectedDays.includes(day) && day <= doc.daysInMonth ? <svg viewBox="0 0 20 24" preserveAspectRatio="none" aria-label={`เบิกวันที่ ${day}`}><line x1="0" y1="24" x2="20" y2="0" /></svg> : null}
              </td>;
            })}</tr>
          </tbody>
        </table>
      </div>
      <table className="claim-form-orders" aria-label="คำสั่งปฏิบัติงาน">
        <colgroup><col style={{ width: "3%" }} /><col style={{ width: "22%" }} /><col style={{ width: "17%" }} /><col style={{ width: "25%" }} /><col style={{ width: "20%" }} /><col style={{ width: "13%" }} /></colgroup>
        <thead data-orders-heading><tr><th>ที่</th><th>คำสั่ง</th><th>สถานที่ปฏิบัติงาน</th><th>ปฏิบัติงานระหว่างวันที่</th><th>ผู้ควบคุม</th><th>ตำแหน่งและสังกัด</th></tr></thead>
        <tbody>
          {page.rowIndices.map((rowIndex) => {
            const order = doc.orders[rowIndex];
            return <tr key={rowIndex} data-order-row={rowIndex}>
              <td>{rowIndex + 1}</td><td>{order.id}</td><td>{order.location}</td><td>{order.period}</td>
              <td><div className="claim-form-signature">{order.signatureUrl ? <img src={order.signatureUrl} alt={`ลายเซ็นผู้ควบคุม ${order.id}`} /> : null}</div>{order.leaderName ? <div className="claim-form-leader">({order.leaderName})</div> : null}</td>
              <td className="claim-form-position">{order.leaderPosition}{order.leaderDepartment ? <><br />{order.leaderDepartment}</> : null}</td>
            </tr>;
          })}
          {Array.from({ length: page.blankRows }, (_, i) => <tr key={`blank-${i}`} data-blank-row><td>{(page.rowIndices.at(-1) ?? -1) + i + 2}</td><td /><td /><td /><td /><td /></tr>)}
        </tbody>
      </table>
      {(page.noteText || page.blankNoteLines > 0 || measurement) && <div className="claim-form-notes" data-notes>
        <div className="claim-form-note-label" data-note-label>หมายเหตุ{pageNumber > 1 ? " (ต่อ)" : ""}</div>
        <div className="claim-form-note-text" data-note-text style={{ minHeight: `${page.blankNoteLines * 6}mm` }}>{page.noteText}</div>
      </div>}
      </div>
      <div className="claim-form-footer" data-sheet-footer>
        <span>สถานะ: {doc.status}{doc.approved ? "" : " (ยังไม่อนุมัติ)"}</span>
        <span>คำขอ {doc.id} · หน้า {pageNumber}/{totalPages}</span>
      </div>
    </article>
  );
}
