import type {
  ExpenseClaimDocumentWithRelations,
  UpdateExpenseClaimDocumentInput,
  CreateExpenseClaimDocumentInput,
} from "@/lib/domains/expense-claim-document/types";
import type { ClaimDocumentStatus } from "@/lib/shared/types";
import { decimalText, toMonthInput } from "@/lib/shared/format";
export interface ClaimFormState {
  expenseMonth: string;
  claimantPositionAtSubmission: string;
  remark: string;
  status: ClaimDocumentStatus;
  countDates: string;
  amount: string;
}

const toMonthDate = (month: string) => `${month}-01`;
export function claimUpdatePayload(
  selected: ExpenseClaimDocumentWithRelations | null,
  form: ClaimFormState,
  selectedOffSiteWorkIds: string[],
  selectedClaimDates: string[],
  dateCount: number,
  totalAmount: number,
): UpdateExpenseClaimDocumentInput {
  if (!selected) return {};

  const base: UpdateExpenseClaimDocumentInput = {
    expenseMonth:
      toMonthInput(selected.expenseMonth) !== form.expenseMonth
        ? toMonthDate(form.expenseMonth)
        : undefined,
    claimantPositionAtSubmission:
      selected.claimantPositionAtSubmission !==
      form.claimantPositionAtSubmission
        ? form.claimantPositionAtSubmission.trim()
        : undefined,
    remark:
      (selected.remark || "") !== form.remark
        ? form.remark.trim() || null
        : undefined,
  };

  if (selected.status === "DRAFT") {
    // For DRAFT edits, always include OSW selection and derived dates/amounts
    return {
      ...base,
      offSiteWorkIds: selectedOffSiteWorkIds,
      selectedDates:
        selectedClaimDates.length > 0 ? selectedClaimDates : undefined,
      countDates: dateCount > 0 ? String(dateCount) : undefined,
      amount: totalAmount > 0 ? String(totalAmount) : undefined,
    };
  }

  return {
    ...base,
    countDates:
      decimalText(selected.countDates) !== form.countDates
        ? form.countDates.trim() || null
        : undefined,
    amount:
      decimalText(selected.amount) !== form.amount
        ? form.amount.trim() || null
        : undefined,
  };
}

export function claimCreatePayload(
  form: ClaimFormState,
  selectedOffSiteWorkIds: string[],
  selectedClaimDates: string[],
  dateCount: number,
  totalAmount: number,
  status: ClaimDocumentStatus,
): CreateExpenseClaimDocumentInput {
  return {
    expenseMonth: toMonthDate(form.expenseMonth),
    claimantPositionAtSubmission: form.claimantPositionAtSubmission.trim(),
    offSiteWorkIds:
      selectedOffSiteWorkIds.length > 0 ? selectedOffSiteWorkIds : undefined,
    selectedDates:
      selectedClaimDates.length > 0 ? selectedClaimDates : undefined,
    countDates: dateCount > 0 ? String(dateCount) : undefined,
    amount: totalAmount > 0 ? String(totalAmount) : undefined,
    remark: form.remark.trim() || undefined,
    status,
  };
}
