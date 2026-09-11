// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  cleanup,
  render,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { workflowTheme } from "@/components/workflow-ui/theme";
const mock = vi.hoisted(() => ({
  eligible: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
  review: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams("tab=monthly-requests"),
}));
vi.mock("@/lib/hooks/use-scoped-permission", () => ({
  useScopedPermission: () => ({ userId: "me", allows: () => true }),
}));
vi.mock("@/app/actions/monthly-request-collection", () => ({
  listEligibleExpenseClaimsForMonth: mock.eligible,
  createMonthlyRequestCollection: mock.create,
  listMonthlyRequestCollections: mock.list,
  reviewMonthlyRequestCollectionStep: mock.review,
  cancelMonthlyRequestCollection: vi.fn(),
  submitMonthlyRequestCollection: vi.fn(),
  updateMonthlyRequestCollection: vi.fn(),
}));
import { MrcClient } from "@/app/monthly-request-collection/monthly-request-collection-client";
beforeEach(() => {
  vi.clearAllMocks();
  mock.eligible.mockResolvedValue({
    success: true,
    data: ["PENDING", "PENDING_LEADER_VERIFY", "WAIT_FOR_COLLECTION"].map(
      (status, i) => ({
        id: `claim-${i}`,
        status,
        isVerified: status === "WAIT_FOR_COLLECTION",
        countDates: "1",
        amount: "150",
        claimantPositionAtSubmission: "ตำแหน่งเดิม",
        claimant: { firstName: "ผู้", lastName: `ทดสอบ ${i}` },
      }),
    ),
  });
  mock.create.mockResolvedValue({ success: false, error: "fixture failure" });
});
afterEach(cleanup);
it("keeps all service-eligible statuses selectable, including pending leader verification", async () => {
  render(
    <ThemeProvider theme={workflowTheme}>
      <MrcClient
        initialItems={[]}
        initialPagination={null}
        canManage
        canHpa={false}
        canRk={false}
        canDrt={false}
      />
    </ThemeProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "สร้างรายการ" }));
  const pending = await screen.findByRole("checkbox", {
    name: "เลือกเอกสารเบิก claim-1",
  });
  expect((pending as HTMLInputElement).disabled).toBe(false);
  fireEvent.click(
    screen.getByRole("checkbox", { name: "เลือกหรือยกเลิกเลือกทั้งหมด" }),
  );
  expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(4);
  fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));
  await waitFor(() => expect(mock.create).toHaveBeenCalled());
  expect(mock.create.mock.calls[0][0].expenseClaimIds).toEqual([
    "claim-0",
    "claim-1",
    "claim-2",
  ]);
});
