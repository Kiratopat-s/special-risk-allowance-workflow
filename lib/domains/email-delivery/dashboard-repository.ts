import { Prisma, type PrismaClient } from "@/lib/generated/prisma/client";
import type { EmailDashboardFilter } from "./dashboard-types";
import { bangkokDateBounds } from "./dashboard-validation";
import { loadEmailContext } from "./repository";

const pageSize = 25;
function pagination(total: number, requested = 1) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requested, totalPages);
  return { page, pageSize, total, totalPages, hasNext: page < totalPages, hasPrevious: page > 1 };
}

function conditions(filter: EmailDashboardFilter) {
  const clauses: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (filter.status) clauses.push(Prisma.sql`d.status = ${filter.status}::"EmailDeliveryStatus"`);
  const bounds = bangkokDateBounds(filter);
  if (bounds.from) clauses.push(Prisma.sql`d.created_at >= ${bounds.from}`);
  if (bounds.until) clauses.push(Prisma.sql`d.created_at < ${bounds.until}`);
  if (filter.search) {
    const match = `%${filter.search.replace(/[\\%_]/g, "\\$&")}%`;
    clauses.push(Prisma.sql`(
      d.id ILIKE ${match} OR d.expense_claim_id ILIKE ${match} OR d.leader_user_id ILIKE ${match}
      OR d.recipient_email ILIKE ${match}
      OR d.context_snapshot->>'claimantName' ILIKE ${match}
      OR d.context_snapshot->>'leaderName' ILIKE ${match}
      OR d.context_snapshot->>'recipientEmail' ILIKE ${match}
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(d.context_snapshot->'orders') = 'array' THEN d.context_snapshot->'orders' ELSE '[]'::jsonb END
      ) o WHERE o->>'reference' ILIKE ${match} OR o->>'offSiteWorkId' ILIKE ${match})
      OR EXISTS (SELECT 1 FROM email_delivery_attempts a WHERE a.delivery_id = d.id AND (
        a.recipient_email ILIKE ${match} OR a.context_snapshot->>'recipientEmail' ILIKE ${match}
        OR a.context_snapshot->>'claimantName' ILIKE ${match}
        OR a.context_snapshot->>'leaderName' ILIKE ${match}
        OR EXISTS (SELECT 1 FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(a.context_snapshot->'orders') = 'array' THEN a.context_snapshot->'orders' ELSE '[]'::jsonb END
        ) o WHERE o->>'reference' ILIKE ${match} OR o->>'offSiteWorkId' ILIKE ${match})
      ))
      OR EXISTS (SELECT 1 FROM users u WHERE u.id = d.leader_user_id
        AND (concat_ws(' ', u.first_name, u.last_name) ILIKE ${match} OR u.email ILIKE ${match}))
      OR EXISTS (SELECT 1 FROM expense_claims c JOIN users u ON u.id = c.user_id
        WHERE c.id = d.expense_claim_id AND concat_ws(' ', u.first_name, u.last_name) ILIKE ${match})
      OR EXISTS (SELECT 1 FROM leader_verifications v JOIN off_site_works w ON w.id = v.off_site_work_id
        WHERE v.id = ANY(d.verification_ids) AND v.expense_claim_id = d.expense_claim_id
          AND v.leader_user_id = d.leader_user_id AND w.inner_ref_document_id ILIKE ${match})
    )`);
  }
  return Prisma.join(clauses, " AND ");
}

export function createEmailDashboardRepository(client: PrismaClient) {
  return {
    async list(filter: EmailDashboardFilter) {
      return client.$transaction(async (tx) => {
        const where = conditions(filter);
        const [count] = await tx.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total FROM email_deliveries d WHERE ${where}`;
        const pages = pagination(count.total, filter.page);
        const ids = await tx.$queryRaw<{ id: string }[]>`
          SELECT d.id FROM email_deliveries d WHERE ${where}
          ORDER BY d.created_at DESC, d.id DESC LIMIT ${pageSize} OFFSET ${(pages.page - 1) * pageSize}
        `;
        const rows = await tx.emailDelivery.findMany({
          where: { id: { in: ids.map((row) => row.id) } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        });
        // Interactive transactions use one connection; do not overlap its queries.
        const claims = await tx.expenseClaim.findMany({ where: { id: { in: rows.map((row) => row.expenseClaimId) } },
          select: { id: true, expenseMonth: true, claimant: { select: { firstName: true, lastName: true } } } });
        const leaders = await tx.user.findMany({ where: { id: { in: rows.map((row) => row.leaderUserId) } },
          select: { id: true, firstName: true, lastName: true } });
        return { rows, claims, leaders, pagination: pages };
      }, { isolationLevel: "RepeatableRead" });
    },

    async detail(id: string, attemptPage: number) {
      return client.$transaction(async (tx) => {
        const row = await tx.emailDelivery.findUnique({ where: { id } });
        if (!row) return null;
        const pages = pagination(await tx.emailDeliveryAttempt.count({ where: { deliveryId: id } }), attemptPage);
        const attempts = await tx.emailDeliveryAttempt.findMany({ where: { deliveryId: id },
          orderBy: [{ startedAt: "desc" }, { id: "desc" }], skip: (pages.page - 1) * pageSize, take: pageSize });
        const context = await loadEmailContext(tx, row);
        const actors = await tx.user.findMany({ where: { id: { in: attempts.flatMap((attempt) => attempt.requestedById ? [attempt.requestedById] : []) } },
          select: { id: true, firstName: true, lastName: true } });
        const clock = await tx.$queryRaw<{ now: Date }[]>`SELECT CURRENT_TIMESTAMP AS now`;
        return { row, context, actors, attempts, pagination: pages, measuredAt: clock[0].now };
      }, { isolationLevel: "RepeatableRead" });
    },

    async overview() {
      return client.$transaction(async (tx) => {
        const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT CURRENT_TIMESTAMP AS now`;
        const measuredAt = clock.now;
        const [totals] = await tx.$queryRaw<{
          readyCount: number; processingCount: number; retryWaitCount: number; failedCount: number;
          acceptedLast24HoursCount: number; expiredLeaseCount: number; oldestReadyAt: Date | null;
        }[]>`SELECT
          count(*) FILTER (WHERE status IN ('PENDING', 'RETRY_WAIT') AND next_attempt_at <= ${measuredAt})::int AS "readyCount",
          count(*) FILTER (WHERE status = 'PROCESSING')::int AS "processingCount",
          count(*) FILTER (WHERE status = 'RETRY_WAIT' AND next_attempt_at > ${measuredAt})::int AS "retryWaitCount",
          count(*) FILTER (WHERE status = 'FAILED')::int AS "failedCount",
          count(*) FILTER (WHERE status = 'ACCEPTED' AND accepted_at >= ${new Date(measuredAt.getTime() - 86_400_000)})::int AS "acceptedLast24HoursCount",
          count(*) FILTER (WHERE status = 'PROCESSING' AND lease_expires_at <= ${measuredAt})::int AS "expiredLeaseCount",
          min(next_attempt_at) FILTER (WHERE status IN ('PENDING', 'RETRY_WAIT') AND next_attempt_at <= ${measuredAt}) AS "oldestReadyAt"
          FROM email_deliveries`;
        const fresh = { stoppedAt: null, lastHeartbeatAt: { gte: new Date(measuredAt.getTime() - 90_000) } };
        const active = await tx.emailWorkerRun.findMany({ where: fresh, orderBy: [{ startedAt: "desc" }, { id: "desc" }] });
        const recent = await tx.emailWorkerRun.findMany({ orderBy: [{ startedAt: "desc" }, { id: "desc" }], take: 20 });
        const activeWorkerCount = await tx.emailWorkerRun.count({ where: fresh });
        const workers = [...new Map([...active, ...recent].map((worker) => [worker.id, worker])).values()]
          .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime() || b.id.localeCompare(a.id));
        return { ...totals, measuredAt, activeWorkerCount, workers };
      }, { isolationLevel: "RepeatableRead" });
    },
  };
}
