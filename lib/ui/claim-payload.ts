import type {
  ExpenseClaimDocumentWithRelations,
  UpdateExpenseClaimDocumentInput,
  CreateExpenseClaimDocumentInput,
} from "@/lib/domains/expense-claim-document/types";
import type { ClaimDocumentStatus } from "@/lib/shared/types";
import { toMonthInput } from "@/lib/shared/format";
import { isClaimMutationLocked } from "@/lib/shared/claim-mutation";
export interface ClaimFormState {
  expenseMonth: string;
  claimantPositionAtSubmission: string;
  remark: string;
}

const toMonthDate = (month: string) => `${month}-01`;
export function claimUpdatePayload(
  selected: ExpenseClaimDocumentWithRelations | null,
  form: ClaimFormState,
  selectedOffSiteWorkIds: string[],
  selectedClaimDates: string[],
): UpdateExpenseClaimDocumentInput {
  if (!selected || isClaimMutationLocked(selected)) return {};

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

  // The server derives totals from the actual selection, including an empty draft.
  return {
    ...base,
    offSiteWorkIds: selectedOffSiteWorkIds,
    selectedDates: selectedClaimDates,
  };
}

export function claimCreatePayload(
  form: ClaimFormState,
  selectedOffSiteWorkIds: string[],
  selectedClaimDates: string[],
  status: ClaimDocumentStatus,
): CreateExpenseClaimDocumentInput {
  return {
    expenseMonth: toMonthDate(form.expenseMonth),
    claimantPositionAtSubmission: form.claimantPositionAtSubmission.trim(),
    offSiteWorkIds: selectedOffSiteWorkIds,
    selectedDates: selectedClaimDates,
    remark: form.remark.trim() || undefined,
    status,
  };
}
