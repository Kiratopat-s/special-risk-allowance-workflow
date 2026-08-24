import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { Session } from "next-auth";
import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  FileText,
  FolderOpen,
  MapPin,
  PenLine,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { authorizationService } from "@/lib/domains/permission";
import { listOffSiteWorks } from "@/app/actions/off-site-work";
import { OffSiteWorkClient } from "@/app/off-site-work/off-site-work-client";
import { listExpenseClaimDocuments } from "@/app/actions/expense-claim-document";
import { ExpenseClaimDocumentClient } from "@/app/expense-claim-document/expense-claim-document-client";
import { listMonthlyRequestCollections } from "@/app/actions/monthly-request-collection";
import { MrcClient } from "@/app/monthly-request-collection/monthly-request-collection-client";
import type { MonthlyRequestCollectionWithRelations } from "@/lib/domains/monthly-request-collection";
import {
  getMyActiveSignatureDataUrl,
  listMyPendingVerifications,
} from "@/app/actions/leader-verify";
import { PendingVerificationsClient } from "@/app/leader-verify/pending/pending-client";
import { getMySignatureState } from "@/app/actions/user-signature";
import { SignatureClient } from "@/app/signature/signature-client";
import type { PermissionAction, PermissionResource } from "@/lib/shared/types";
import {
  CardGridSkeleton,
  DetailPanelSkeleton,
  TableSkeleton,
  ToolbarSkeleton,
} from "@/components/ui/skeleton";
import { DashboardTabNav } from "./dashboard-tab-nav";

type SearchParams = Record<string, string | string[] | undefined>;
type AuthSession = Session | null;

const DASHBOARD_TABS = [
  "off-site-work",
  "expense-claims",
  "monthly-requests",
  "leader-queue",
  "signature",
] as const;

type DashboardTabId = (typeof DASHBOARD_TABS)[number];

interface DashboardTabMeta {
  id: DashboardTabId;
  label: string;
  description: string;
  icon: LucideIcon;
}

interface MonthlyAccess {
  canManage: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canFinalize: boolean;
  canComplete: boolean;
  canCancel: boolean;
  canVoid: boolean;
  canPrint: boolean;
  canExport: boolean;
}

interface PermissionCheck {
  resource: PermissionResource;
  action: PermissionAction;
}

const TAB_META: Record<DashboardTabId, DashboardTabMeta> = {
  "off-site-work": {
    id: "off-site-work",
    label: "Off-site Work",
    description: "คำสั่งออกนอกสถานที่",
    icon: MapPin,
  },
  "expense-claims": {
    id: "expense-claims",
    label: "Expense Claims",
    description: "เอกสารเบิกค่าใช้จ่าย",
    icon: FileText,
  },
  "monthly-requests": {
    id: "monthly-requests",
    label: "Monthly Requests",
    description: "รวบรวมรายเดือน",
    icon: FolderOpen,
  },
  "leader-queue": {
    id: "leader-queue",
    label: "Leader Queue",
    description: "คิวยืนยันการออกปฏิบัติงาน",
    icon: ClipboardList,
  },
  signature: {
    id: "signature",
    label: "Signature",
    description: "ลายมือชื่อของฉัน",
    icon: PenLine,
  },
};

function getParam(params: SearchParams, key: string): string | null {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function isDashboardTabId(value: string | null): value is DashboardTabId {
  return DASHBOARD_TABS.includes(value as DashboardTabId);
}

function dashboardHref(
  tab: DashboardTabId,
  options?: { claimId?: string | null },
): string {
  const params = new URLSearchParams({ tab });
  if (tab === "expense-claims" && options?.claimId) {
    params.set("claimId", options.claimId);
  }
  return `/dashboard?${params.toString()}`;
}

function currentDashboardPath(params: SearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else if (value) {
      query.set(key, value);
    }
  }
  const search = query.toString();
  return search ? `/dashboard?${search}` : "/dashboard";
}

function getLockedClaimantPosition(
  positionShort?: string | null,
  positionLevel?: string | null,
): string {
  const short = (positionShort ?? "").trim();
  const level = (positionLevel ?? "").trim();

  if (!short) return "-";

  const shortOnlyKeywords = ["ชผ", "หผ", "รก", "อก"];
  const shouldUseShortOnly = shortOnlyKeywords.some((keyword) =>
    short.includes(keyword),
  );

  if (shouldUseShortOnly || !level) return short;

  return `${short} ${level}`.trim();
}

function serializeDecimal(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "object") {
    if ("toJSON" in (obj as object)) {
      return (obj as { toJSON(): unknown }).toJSON();
    }
    if (Array.isArray(obj)) {
      return obj.map(serializeDecimal);
    }
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        key,
        serializeDecimal(value),
      ]),
    );
  }
  return obj;
}

async function renderOffSiteWorkTab() {
  const result = await listOffSiteWorks({ page: 1, pageSize: 50 });
  const data = result.success
    ? { items: result.data.data, pagination: result.data.pagination }
    : { items: [], pagination: null };

  return (
    <OffSiteWorkClient
      initialItems={data.items}
      initialPagination={data.pagination}
    />
  );
}

async function renderExpenseClaimsTab(
  session: AuthSession,
  claimId: string | null,
) {
  const result = await listExpenseClaimDocuments({ page: 1, pageSize: 20 });
  const currentUserDisplayName =
    session?.user?.firstName || session?.user?.lastName
      ? `${session.user.firstName ?? ""} ${session.user.lastName ?? ""}`.trim()
      : session?.user?.name || "Current User";
  const currentUserClaimantPositionAtSubmission = getLockedClaimantPosition(
    session?.user?.positionShort,
    session?.user?.positionLevel,
  );
  const data = result.success
    ? { items: result.data.data, pagination: result.data.pagination }
    : { items: [], pagination: null };

  return (
    <ExpenseClaimDocumentClient
      initialItems={data.items}
      initialPagination={data.pagination}
      initialViewId={claimId}
      currentUserDisplayName={currentUserDisplayName}
      currentUserClaimantPositionAtSubmission={
        currentUserClaimantPositionAtSubmission
      }
    />
  );
}

async function renderMonthlyRequestsTab(monthlyAccess: MonthlyAccess) {
  const result = await listMonthlyRequestCollections({ page: 1, pageSize: 20 });
  const data = result.success
    ? {
        items: result.data.data.map((item) =>
          serializeDecimal(item),
        ) as MonthlyRequestCollectionWithRelations[],
        pagination: result.data.pagination,
      }
    : { items: [], pagination: null };

  return (
    <MrcClient
      initialItems={data.items}
      initialPagination={data.pagination}
      canManage={monthlyAccess.canManage}
      canCreate={monthlyAccess.canCreate}
      canUpdate={monthlyAccess.canUpdate}
      canFinalize={monthlyAccess.canFinalize}
      canComplete={monthlyAccess.canComplete}
      canCancel={monthlyAccess.canCancel}
      canVoid={monthlyAccess.canVoid}
      canPrint={monthlyAccess.canPrint}
      canExport={monthlyAccess.canExport}
    />
  );
}

async function renderLeaderQueueTab() {
  const [result, sigResult] = await Promise.all([
    listMyPendingVerifications(),
    getMyActiveSignatureDataUrl(),
  ]);

  return (
    <PendingVerificationsClient
      initialItems={result.success ? result.data : []}
      existingSignatureDataUrl={sigResult.success ? sigResult.data : null}
    />
  );
}

async function renderSignatureTab(session: AuthSession) {
  const result = await getMySignatureState();

  return (
    <SignatureClient
      initialState={result.success ? result.data : null}
      userName={session?.user?.name}
    />
  );
}

async function DashboardTabContent({
  activeTab,
  session,
  claimId,
  monthlyAccess,
}: {
  activeTab: DashboardTabId;
  session: AuthSession;
  claimId: string | null;
  monthlyAccess: MonthlyAccess;
}) {
  if (activeTab === "off-site-work") return renderOffSiteWorkTab();
  if (activeTab === "expense-claims") {
    return renderExpenseClaimsTab(session, claimId);
  }
  if (activeTab === "monthly-requests") {
    return renderMonthlyRequestsTab(monthlyAccess);
  }
  if (activeTab === "leader-queue") return renderLeaderQueueTab();
  return renderSignatureTab(session);
}

function DashboardTabSkeleton({ tab }: { tab: DashboardTabId }) {
  if (tab === "monthly-requests") {
    return <TableSkeleton columns={6} rows={6} />;
  }

  if (tab === "signature") {
    return <DetailPanelSkeleton />;
  }

  return (
    <div className="space-y-6">
      <ToolbarSkeleton />
      <CardGridSkeleton />
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const session = (await auth()) as AuthSession;

  if (!session?.user?.dbUserId) {
    redirect(
      `/api/auth/signin?callbackUrl=${encodeURIComponent(
        currentDashboardPath(params),
      )}`,
    );
  }

  const userId = session.user.dbUserId;
  const requestedTab = getParam(params, "tab");
  const claimId = getParam(params, "claimId");

  if (claimId && requestedTab !== "expense-claims") {
    redirect(dashboardHref("expense-claims", { claimId }));
  }

  const effectivePermissions =
    await authorizationService.getEffectivePermissions(userId);
  const permissions = effectivePermissions.success
    ? effectivePermissions.data.permissions
    : [];
  const hasPermission = (resource: PermissionResource, action: PermissionAction) =>
    permissions.some(
      (permission) =>
        permission.resource === resource &&
        (permission.action === action || permission.action === "MANAGE"),
    );
  const hasAnyPermission = (checks: PermissionCheck[]) =>
    checks.some((check) => hasPermission(check.resource, check.action));

  const hasOffSiteWorkAccess = hasAnyPermission([
    { resource: "OFF_SITE_WORK", action: "READ" },
    { resource: "OFF_SITE_WORK", action: "LIST" },
    { resource: "OFF_SITE_WORK", action: "CREATE" },
    { resource: "OFF_SITE_WORK", action: "MANAGE" },
  ]);
  const hasExpenseClaimAccess = hasAnyPermission([
    { resource: "EXPENSE_CLAIM", action: "READ" },
    { resource: "EXPENSE_CLAIM", action: "LIST" },
    { resource: "EXPENSE_CLAIM", action: "CREATE" },
    { resource: "EXPENSE_CLAIM", action: "MANAGE" },
  ]);
  const hasSignatureAccess = hasAnyPermission([
    { resource: "SIGNATURE", action: "READ" },
    { resource: "SIGNATURE", action: "CREATE" },
    { resource: "SIGNATURE", action: "UPDATE" },
    { resource: "SIGNATURE", action: "MANAGE" },
  ]);
  const canManageMonthly = hasPermission("MONTHLY_REQUEST", "MANAGE");
  const monthlyAccess = {
    canManage: canManageMonthly,
    canCreate: hasPermission("MONTHLY_REQUEST", "CREATE"),
    canUpdate: hasPermission("MONTHLY_REQUEST", "UPDATE"),
    canFinalize: hasPermission("MONTHLY_REQUEST", "FINALIZE"),
    canComplete: hasPermission("MONTHLY_REQUEST", "COMPLETE"),
    canCancel: hasPermission("MONTHLY_REQUEST", "CANCEL"),
    canVoid: hasPermission("MONTHLY_REQUEST", "VOID"),
    canPrint: hasPermission("MONTHLY_REQUEST", "PRINT"),
    canExport: hasPermission("MONTHLY_REQUEST", "EXPORT"),
  };
  const hasMonthlyRequestAccess = hasAnyPermission([
    { resource: "MONTHLY_REQUEST", action: "READ" },
    { resource: "MONTHLY_REQUEST", action: "LIST" },
    { resource: "MONTHLY_REQUEST", action: "CREATE" },
    { resource: "MONTHLY_REQUEST", action: "MANAGE" },
  ]);

  const tabAccess: Record<DashboardTabId, boolean> = {
    "off-site-work": hasOffSiteWorkAccess,
    "expense-claims": hasExpenseClaimAccess,
    "monthly-requests": hasMonthlyRequestAccess,
    "leader-queue": true,
    signature: hasSignatureAccess,
  };
  const visibleTabs = DASHBOARD_TABS.filter((tab) => tabAccess[tab]).map(
    (tab) => TAB_META[tab],
  );
  const firstVisibleTab = visibleTabs[0]?.id ?? "leader-queue";

  if (!isDashboardTabId(requestedTab) || !tabAccess[requestedTab]) {
    redirect(dashboardHref(firstVisibleTab));
  }

  const activeTab = requestedTab;
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            เข้าถึงงานหลักทั้งหมดจากหน้าเดียว
          </p>
        </div>

        <DashboardTabNav
          activeTab={activeTab}
          tabs={visibleTabs.map((tab) => ({
            id: tab.id,
            label: tab.label,
            description: tab.description,
            href: dashboardHref(tab.id, {
              claimId: tab.id === "expense-claims" ? claimId : null,
            }),
          }))}
        />

        <section aria-live="polite">
          <Suspense
            key={`${activeTab}:${claimId ?? ""}`}
            fallback={<DashboardTabSkeleton tab={activeTab} />}
          >
            <DashboardTabContent
              activeTab={activeTab}
              session={session}
              claimId={claimId}
              monthlyAccess={monthlyAccess}
            />
          </Suspense>
        </section>
      </div>
    </div>
  );
}
