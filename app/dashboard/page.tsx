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
import { Overview } from "./overview";
import { parseClaimListQuery } from "@/lib/ui/list-query";

type SearchParams = Record<string, string | string[] | undefined>;
type AuthSession = Session | null;

const DASHBOARD_TABS = [
  "overview",
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
  canHpa: boolean;
}

interface PermissionCheck {
  resource: PermissionResource;
  action: PermissionAction;
}

const TAB_META: Record<DashboardTabId, DashboardTabMeta> = {
  overview: {
    id: "overview",
    label: "ภาพรวม",
    description: "ภาพรวมการเบิกค่าใช้จ่าย",
    icon: FileText,
  },
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
      Object.entries(obj).map(([key, value]) => [key, serializeDecimal(value)]),
    );
  }
  return obj;
}

async function renderOffSiteWorkTab(params: SearchParams) {
  const filters = parseClaimListQuery(
    new URLSearchParams(currentDashboardPath(params).split("?")[1]),
  );
  const result = await listOffSiteWorks({
    page: filters.page,
    pageSize: 50,
    search: filters.search,
  });
  if (!result.success) return <ReadFailure error={result.error} />;
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
  params: SearchParams,
) {
  const filters = parseClaimListQuery(
    new URLSearchParams(currentDashboardPath(params).split("?")[1]),
  );
  const result = await listExpenseClaimDocuments({ ...filters, pageSize: 20 });
  if (!result.success) return <ReadFailure error={result.error} />;
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

async function renderMonthlyRequestsTab(
  monthlyAccess: MonthlyAccess,
  params: SearchParams,
) {
  const filters = parseClaimListQuery(
    new URLSearchParams(currentDashboardPath(params).split("?")[1]),
  );
  const result = await listMonthlyRequestCollections({
    page: filters.page,
    pageSize: 20,
    search: filters.search,
    status: filters.status,
    collectForMonthFrom: filters.expenseMonthFrom,
    collectForMonthTo: filters.expenseMonthTo,
  });
  if (!result.success) return <ReadFailure error={result.error} />;
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
      canHpa={monthlyAccess.canHpa}
    />
  );
}

async function renderLeaderQueueTab() {
  const [result, sigResult] = await Promise.all([
    listMyPendingVerifications(),
    getMyActiveSignatureDataUrl(),
  ]);

  if (!result.success) return <ReadFailure error={result.error} />;
  return (
    <PendingVerificationsClient
      initialItems={result.success ? result.data : []}
      existingSignatureDataUrl={sigResult.success ? sigResult.data : null}
    />
  );
}

async function renderSignatureTab(session: AuthSession) {
  const result = await getMySignatureState();

  if (!result.success) return <ReadFailure error={result.error} />;
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
  params,
}: {
  activeTab: DashboardTabId;
  session: AuthSession;
  claimId: string | null;
  monthlyAccess: MonthlyAccess;
  params: SearchParams;
}) {
  if (activeTab === "overview")
    return (
      <Overview
        month={getParam(params, "month") ?? undefined}
        name={session?.user?.firstName || session?.user?.name || ""}
      />
    );
  if (activeTab === "off-site-work") return renderOffSiteWorkTab(params);
  if (activeTab === "expense-claims") {
    return renderExpenseClaimsTab(session, claimId, params);
  }
  if (activeTab === "monthly-requests") {
    return renderMonthlyRequestsTab(monthlyAccess, params);
  }
  if (activeTab === "leader-queue") return renderLeaderQueueTab();
  return renderSignatureTab(session);
}

function DashboardTabSkeleton({ tab }: { tab: DashboardTabId }) {
  if (tab === "overview") {
    return (
      <div className="space-y-6" role="status" aria-label="กำลังโหลดภาพรวม">
        <ToolbarSkeleton />
        <div className="grid gap-4 sm:grid-cols-3" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-40 animate-pulse rounded-2xl border bg-card"
            />
          ))}
        </div>
        <TableSkeleton columns={4} rows={4} />
      </div>
    );
  }
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
  const legacyViewId = getParam(params, "view");

  if (legacyViewId) {
    redirect(
      dashboardHref("expense-claims", { claimId: claimId ?? legacyViewId }),
    );
  }

  if (claimId && requestedTab !== "expense-claims") {
    redirect(dashboardHref("expense-claims", { claimId }));
  }

  const effectivePermissions =
    await authorizationService.getEffectivePermissions(userId);
  const permissions = effectivePermissions.success
    ? effectivePermissions.data.permissions
    : [];
  const roles = effectivePermissions.success
    ? effectivePermissions.data.roles
    : [];

  const hasPermission = (
    resource: PermissionResource,
    action: PermissionAction,
  ) =>
    permissions.some(
      (permission) =>
        permission.resource === resource &&
        (permission.action === action || permission.action === "MANAGE"),
    );
  const hasExactPermission = (
    resource: PermissionResource,
    action: PermissionAction,
  ) =>
    permissions.some(
      (permission) =>
        permission.resource === resource && permission.action === action,
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
  const isSuperAdmin = roles.some((role) => role.code === "super-admin");
  const exactHpa = hasExactPermission("MONTHLY_REQUEST", "REVIEW_HPA");

  const monthlyAccess = {
    canManage: canManageMonthly,
    canHpa: exactHpa || isSuperAdmin,
  };
  const hasMonthlyRequestAccess =
    monthlyAccess.canManage ||
    monthlyAccess.canHpa ||
    hasPermission("MONTHLY_REQUEST", "LIST") ||
    hasPermission("MONTHLY_REQUEST", "READ");

  const tabAccess: Record<DashboardTabId, boolean> = {
    overview: true,
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

  if (
    requestedTab &&
    (!isDashboardTabId(requestedTab) || !tabAccess[requestedTab])
  ) {
    redirect(dashboardHref(firstVisibleTab));
  }

  const activeTab: DashboardTabId = isDashboardTabId(requestedTab)
    ? requestedTab
    : "overview";
  return (
    <div className="workspace-content">
      <div>
        <section aria-live="polite">
          <Suspense
            key={`${activeTab}:${JSON.stringify(parseClaimListQuery(new URLSearchParams(currentDashboardPath(params).split("?")[1])))}`}
            fallback={<DashboardTabSkeleton tab={activeTab} />}
          >
            <DashboardTabContent
              activeTab={activeTab}
              session={session}
              claimId={claimId}
              monthlyAccess={monthlyAccess}
              params={params}
            />
          </Suspense>
        </section>
      </div>
    </div>
  );
}

function ReadFailure({ error }: { error: string }) {
  return (
    <div role="alert" className="document-panel p-8">
      <h1 className="text-lg font-bold">ไม่สามารถแสดงข้อมูลได้</h1>
      <p className="text-sm text-muted-foreground mt-3">{error}</p>
      <p className="text-sm mt-3">
        ตรวจสอบสิทธิ์หรือรีเฟรชหน้าเพื่อลองอีกครั้ง
      </p>
    </div>
  );
}
