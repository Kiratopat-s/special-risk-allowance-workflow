// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ClaimDatesCalendar } from "@/components/expense-claims/claim-dates-calendar";
import { ClaimDetailContent, type ClaimDetailData } from "@/components/expense-claims/claim-detail-content";

afterEach(cleanup);
const claim: ClaimDetailData = {
  id: "claim-1", expenseMonth: "2026-09-01", claimantPositionAtSubmission: "ช่างระดับ 5", selectedDates: ["2026-09-05", "2026-09-07"], countDates: 2, amount: 300, status: "PENDING_LEADER_VERIFY", remark: "ตรวจสอบพื้นที่",
  claimant: { firstName: "ผู้ยื่น", lastName: "ทดสอบ", employeeId: "100001" },
  expenseClaimOffSiteWorks: [{ offSiteWorkId: "work-1", offSiteWork: { id: "work-1", innerRefDocumentId: "กท. 1/2569", startDate: "2026-09-04", endDate: "2026-09-07", location: "พื้นที่ทดสอบ", objective: "ปฏิบัติงานตามคำสั่ง" } }],
};

describe("shared read-only claim details", () => {
  it("shows actual saved dates, Thai weekday headings and non-color responsibility marks", () => {
    const { container } = render(<ClaimDatesCalendar expenseMonth={claim.expenseMonth} selectedDates={claim.selectedDates} countDates={2} highlightedDates={["2026-09-05", "2026-09-06"]} compact />);
    expect(screen.getByRole("table", { name: "ปฏิทินวันที่ที่ยื่นเบิก กันยายน 2569" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "พฤ." })).toBeTruthy();
    expect(screen.getByText("5, 7 ก.ย. 2569")).toBeTruthy();
    expect(container.querySelectorAll('[data-selected="true"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-highlighted="true"]')).toHaveLength(1);
    const selected = container.querySelector('[data-date="2026-09-05"]');
    expect(selected?.className).toContain("border-2");
    expect(selected?.querySelector("svg")).toBeTruthy();
    expect(screen.getByRole("cell", { name: /5 ก.ย. 2569: ยื่นเบิก อยู่ในคำสั่งที่คุณรับผิดชอบ/ })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("keeps count mismatches visible without guessing claim dates", () => {
    const { container } = render(<ClaimDatesCalendar expenseMonth="2026-09" selectedDates={null} countDates={5} />);
    expect(screen.getByText("ยังไม่มีข้อมูลวันที่เบิกที่บันทึกไว้")).toBeTruthy();
    expect(screen.getByText("วันที่ที่บันทึกไว้ 0 วัน ไม่ตรงกับจำนวนที่ขอเบิก 5 วัน")).toBeTruthy();
    expect(container.querySelectorAll('[data-selected="true"]')).toHaveLength(0);
  });
  it("shows safe claim and work information without injecting owner operations", () => {
    const { container } = render(<ClaimDetailContent claim={claim} />);
    expect(screen.getByText("ผู้ยื่น ทดสอบ")).toBeTruthy();
    expect(screen.getByText("ช่างระดับ 5")).toBeTruthy();
    expect(screen.getByText("300 บาท")).toBeTruthy();
    expect(screen.getByText("กท. 1/2569")).toBeTruthy();
    expect(screen.getByText("ปฏิบัติงานตามคำสั่ง")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText("คำสั่งที่คุณกำลังยืนยัน")).toBeNull();
    expect(container.querySelectorAll('[data-highlighted="true"]')).toHaveLength(0);
  });
  it("marks the linked order and its saved dates while retaining the whole claim", () => {
    const detail: ClaimDetailData = {
      ...claim,
      expenseClaimOffSiteWorks: [
        ...claim.expenseClaimOffSiteWorks,
        {
          offSiteWorkId: "work-2",
          offSiteWork: {
            id: "work-2", innerRefDocumentId: "กท. 2/2569", startDate: "2026-09-05", endDate: "2026-09-06", location: "พื้นที่คำสั่งอื่น", objective: "คำสั่งของหัวหน้าอีกคน",
          },
        },
      ],
    };
    const { container } = render(<ClaimDetailContent claim={detail} highlightedDates={["2026-09-05", "2026-09-06"]} highlightedOffSiteWorkId="work-2" />);
    const orders = within(screen.getByRole("region", { name: "คำสั่งที่ใช้ประกอบการเบิก" })).getAllByRole("listitem");
    expect(orders).toHaveLength(2);
    expect(within(orders[0]).queryByText("คำสั่งที่คุณกำลังยืนยัน")).toBeNull();
    expect(within(orders[1]).getByText("คำสั่งที่คุณกำลังยืนยัน")).toBeTruthy();
    expect(screen.getByText("300 บาท")).toBeTruthy();
    expect(screen.getByText("2 วัน")).toBeTruthy();
    expect(screen.getByText("คำสั่งของหัวหน้าอีกคน")).toBeTruthy();
    expect(container.querySelectorAll('[data-selected="true"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-highlighted="true"]')).toHaveLength(1);
    expect(screen.getByRole("cell", { name: "5 ก.ย. 2569: ยื่นเบิก อยู่ในคำสั่งที่คุณรับผิดชอบ" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "6 ก.ย. 2569: ไม่ได้ยื่นเบิก" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("supports a caller-owned verification slot without requiring it", () => {
    render(<ClaimDetailContent claim={claim}><p>ข้อมูลการยืนยันสำหรับเจ้าของ</p></ClaimDetailContent>);
    expect(screen.getByText("ข้อมูลการยืนยันสำหรับเจ้าของ")).toBeTruthy();
  });
});
