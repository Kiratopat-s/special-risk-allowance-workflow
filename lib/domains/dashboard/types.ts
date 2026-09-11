import type { ClaimDocumentStatus } from "@/lib/shared/types";
export interface OverviewClaim {
  id: string;
  title: string;
  claimant: string;
  month: string;
  status: ClaimDocumentStatus;
  amount: number | null;
  days: number | null;
  canView: boolean;
}
export interface OverviewCollection {
  id: string;
  month: string;
  status: ClaimDocumentStatus;
  amount: number | null;
  claimCount: number;
  steps: {
    stage: string;
    status: string;
    reviewer: string | null;
    reviewedAt: string | null;
  }[];
}
export interface DashboardOverview {
  month: string;
  scope: "OWN" | "ALL" | "RESTRICTED";
  claims: null | {
    total: number;
    requestedAmount: number;
    approvedAmount: number;
    inProgress: number;
    requiresAction: number;
    statuses: Partial<Record<ClaimDocumentStatus, number>>;
    recent: OverviewClaim[];
  };
  collections: null | { total: number; recent: OverviewCollection[] };
  nextActions: { label: string; href: string; count?: number }[];
}
