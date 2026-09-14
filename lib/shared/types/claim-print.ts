/** Serializable, minimal presentation data. Never includes verification tokens. */
export interface ClaimPrintOrder {
  id: string;
  location: string;
  period: string;
  leaderName: string;
  leaderPosition: string;
  leaderDepartment: string;
  signatureUrl: string | null;
}

export interface ClaimPrintDocument {
  id: string;
  employeeId: string;
  claimantName: string;
  claimantPosition: string;
  month: string;
  monthName: string;
  buddhistYear: string;
  daysInMonth: number;
  selectedDays: number[];
  countDates: string;
  status: string;
  approved: boolean;
  orders: ClaimPrintOrder[];
  notes: string[];
  warnings: string[];
}
