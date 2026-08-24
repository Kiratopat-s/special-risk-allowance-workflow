import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { Pool, type PoolClient } from "pg";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL?.trim();
const describeWithPostgres = TEST_DATABASE_URL ? describe : describe.skip;
const suiteName = TEST_DATABASE_URL
  ? "PostgreSQL clean-break baseline constraints"
  : "PostgreSQL clean-break baseline constraints (skipped: TEST_DATABASE_URL is not set)";

const EXPENSE_MONTH = "2030-06-01";
const VALID_WE_SAFE_CODE = "WSZ2030HZ0000017489";
const VALID_MATERIAL_HASH = "a".repeat(64);

type PgFailure = Error & {
  code?: string;
  constraint?: string;
};

type ExpectedPgFailure = {
  code: string;
  constraint?: string;
  messageIncludes?: string;
};

type Fixture = {
  departmentId: string;
  claimantId: string;
  collectorId: string;
  claimId: string;
  revisionId: string;
  offSiteWorkId: string;
  revisionOffSiteWorkId: string;
  workDateId: string;
};

let fixtureSequence = 0;
let savepointSequence = 0;

function newFixture(label: string): Fixture {
  fixtureSequence += 1;
  const suffix = `${process.pid}-${fixtureSequence}-${label}`;

  return {
    departmentId: `it-department-${suffix}`,
    claimantId: `it-claimant-${suffix}`,
    collectorId: `it-collector-${suffix}`,
    claimId: `it-claim-${suffix}`,
    revisionId: `it-revision-${suffix}`,
    offSiteWorkId: `it-osw-${suffix}`,
    revisionOffSiteWorkId: `it-revision-osw-${suffix}`,
    workDateId: `it-work-date-${suffix}`,
  };
}

async function expectPgFailure(
  client: PoolClient,
  operation: () => Promise<unknown>,
  expected: ExpectedPgFailure,
): Promise<void> {
  savepointSequence += 1;
  const savepoint = `expected_failure_${savepointSequence}`;
  await client.query(`SAVEPOINT ${savepoint}`);

  let failure: PgFailure | undefined;
  try {
    await operation();
  } catch (error) {
    failure = error as PgFailure;
  }

  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  await client.query(`RELEASE SAVEPOINT ${savepoint}`);

  expect(failure).toBeDefined();
  expect(failure?.code).toBe(expected.code);
  if (expected.constraint) {
    expect(failure?.constraint).toBe(expected.constraint);
  }
  if (expected.messageIncludes) {
    expect(failure?.message).toContain(expected.messageIncludes);
  }
}

async function insertDepartmentAndUsers(
  client: PoolClient,
  fixture: Fixture,
): Promise<void> {
  await client.query(
    `
      INSERT INTO departments (
        id, name, short_name, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, true, clock_timestamp(), clock_timestamp())
    `,
    [
      fixture.departmentId,
      `Integration Department ${fixture.departmentId}`,
      `IT-${process.pid}-${fixtureSequence}`,
    ],
  );

  await client.query(
    `
      INSERT INTO users (
        id, keycloak_id, email, first_name, last_name,
        position_short, department_id, status, created_at, updated_at
      ) VALUES
        ($1, $2, $3, 'ผู้ขอ', 'ทดสอบ', 'วศก.', $5, 'ACTIVE', clock_timestamp(), clock_timestamp()),
        ($4, $6, $7, 'ผู้รวบรวม', 'ทดสอบ', 'นบท.', $5, 'ACTIVE', clock_timestamp(), clock_timestamp())
    `,
    [
      fixture.claimantId,
      `keycloak-${fixture.claimantId}`,
      `${fixture.claimantId}@integration.invalid`,
      fixture.collectorId,
      fixture.departmentId,
      `keycloak-${fixture.collectorId}`,
      `${fixture.collectorId}@integration.invalid`,
    ],
  );
}

async function insertClaimAndDraftRevision(
  client: PoolClient,
  fixture: Fixture,
  options: {
    claimId?: string;
    revisionId?: string;
    claimantId?: string;
  } = {},
): Promise<{ claimId: string; revisionId: string }> {
  const claimId = options.claimId ?? fixture.claimId;
  const revisionId = options.revisionId ?? fixture.revisionId;
  const claimantId = options.claimantId ?? fixture.claimantId;

  await client.query(
    `
      INSERT INTO expense_claims (
        id, expense_month, user_id, created_by_id, status,
        current_revision_no, created_at, updated_at
      ) VALUES ($1, $2::date, $3, $3, 'DRAFT', 1, clock_timestamp(), clock_timestamp())
    `,
    [claimId, EXPENSE_MONTH, claimantId],
  );

  await client.query(
    `
      INSERT INTO expense_claim_revisions (
        id, expense_claim_id, revision_no, status,
        employee_id_snapshot, first_name_snapshot, last_name_snapshot,
        position_short_snapshot, department_id_snapshot, department_name_snapshot,
        rate_per_day, total_days, total_amount, created_at, updated_at
      ) VALUES (
        $1, $2, 1, 'DRAFT',
        '000001', 'ผู้ขอ', 'ทดสอบ',
        'วศก.', $3, 'ฝ่ายทดสอบ',
        150.00, 0, 0.00, clock_timestamp(), clock_timestamp()
      )
    `,
    [revisionId, claimId, fixture.departmentId],
  );

  return { claimId, revisionId };
}

async function insertOffSiteWorkScope(
  client: PoolClient,
  fixture: Fixture,
  options: {
    startDate?: string;
    endDate?: string;
    includeClaimant?: boolean;
  } = {},
): Promise<void> {
  const startDate = options.startDate ?? "2030-06-10";
  const endDate = options.endDate ?? "2030-06-10";

  await client.query(
    `
      INSERT INTO off_site_works (
        id, inner_ref_document_id, start_date, end_date,
        posted_by_user_id, posted_at, leader_first_name, leader_last_name
      ) VALUES ($1, $2, $3::date, $4::date, $5, clock_timestamp(), 'หัวหน้า', 'ทดสอบ')
    `,
    [
      fixture.offSiteWorkId,
      `OSW-${fixtureSequence}`,
      startDate,
      endDate,
      fixture.collectorId,
    ],
  );

  if (options.includeClaimant !== false) {
    await client.query(
      `
        INSERT INTO off_site_work_participants (
          off_site_work_id, user_id, employee_id_snapshot,
          first_name_snapshot, last_name_snapshot, position_short_snapshot,
          department_id_snapshot, department_name_snapshot, created_at
        ) VALUES (
          $1, $2, '000001', 'ผู้ขอ', 'ทดสอบ', 'วศก.',
          $3, 'ฝ่ายทดสอบ', clock_timestamp()
        )
      `,
      [fixture.offSiteWorkId, fixture.claimantId, fixture.departmentId],
    );
  }

  await client.query(
    `
      INSERT INTO expense_claim_revision_off_site_works (
        id, revision_id, off_site_work_id, inner_ref_document_id_snapshot,
        start_date_snapshot, end_date_snapshot,
        leader_first_name_snapshot, leader_last_name_snapshot, created_at
      ) VALUES (
        $1, $2, $3, $4, $5::date, $6::date,
        'หัวหน้า', 'ทดสอบ', clock_timestamp()
      )
    `,
    [
      fixture.revisionOffSiteWorkId,
      fixture.revisionId,
      fixture.offSiteWorkId,
      `OSW-${fixtureSequence}`,
      startDate,
      endDate,
    ],
  );
}

async function insertWorkDate(
  client: PoolClient,
  fixture: Fixture,
  options: {
    workDate?: string;
    dayType?: "DUTY" | "TRAVEL";
    requiresWeSafe?: boolean;
  } = {},
): Promise<void> {
  await client.query(
    `
      INSERT INTO expense_claim_work_dates (
        id, revision_id, revision_off_site_work_id, work_date,
        day_type, holiday_type, holiday_source, requires_we_safe,
        daily_rate, created_at
      ) VALUES (
        $1, $2, $3, $4::date,
        $5::"WorkDayType", 'WORKDAY', 'GOOGLE', $6,
        150.00, clock_timestamp()
      )
    `,
    [
      fixture.workDateId,
      fixture.revisionId,
      fixture.revisionOffSiteWorkId,
      options.workDate ?? "2030-06-10",
      options.dayType ?? "TRAVEL",
      options.requiresWeSafe ?? true,
    ],
  );

  await client.query(
    `
      UPDATE expense_claim_revisions
      SET total_days = 1, total_amount = 150.00, updated_at = clock_timestamp()
      WHERE id = $1
    `,
    [fixture.revisionId],
  );
}

async function submitRevision(
  client: PoolClient,
  revisionId: string,
): Promise<void> {
  await client.query(
    `
      UPDATE expense_claim_revisions
      SET status = 'SUBMITTED',
          submitted_at = clock_timestamp(),
          material_hash = $2,
          updated_at = clock_timestamp()
      WHERE id = $1
    `,
    [revisionId, VALID_MATERIAL_HASH],
  );
}

describeWithPostgres(suiteName, () => {
  let pool: Pool | undefined;
  let client: PoolClient | undefined;

  function database(): PoolClient {
    if (!client) {
      throw new Error("PostgreSQL integration transaction is not active");
    }
    return client;
  }

  beforeAll(async () => {
    pool = new Pool({
      connectionString: TEST_DATABASE_URL,
      max: 1,
    });

    const result = await pool.query<{
      claims: string | null;
      activeClaimIndex: string | null;
    }>(`
      SELECT
        to_regclass('public.expense_claims')::text AS claims,
        to_regclass('public.uq_active_claim_user_month')::text AS "activeClaimIndex"
    `);
    const schema = result.rows[0];
    if (!schema?.claims || !schema.activeClaimIndex) {
      throw new Error(
        "TEST_DATABASE_URL must point to a disposable PostgreSQL database with the clean-break baseline migration applied",
      );
    }
  });

  beforeEach(async () => {
    if (!pool) {
      throw new Error("PostgreSQL integration pool was not initialized");
    }
    client = await pool.connect();
    await client.query("BEGIN");
  });

  afterEach(async () => {
    if (!client) {
      return;
    }
    try {
      await client.query("ROLLBACK");
    } finally {
      client.release();
      client = undefined;
    }
  });

  afterAll(async () => {
    await pool?.end();
    pool = undefined;
  });

  test("allows only one non-cancelled claim per claimant and month", async () => {
    const db = database();
    const fixture = newFixture("active-claim");
    await insertDepartmentAndUsers(db, fixture);
    await insertClaimAndDraftRevision(db, fixture);

    await expectPgFailure(
      db,
      () =>
        db.query(
          `
            INSERT INTO expense_claims (
              id, expense_month, user_id, created_by_id, status,
              current_revision_no, created_at, updated_at
            ) VALUES ($1, $2::date, $3, $3, 'DRAFT', 1, clock_timestamp(), clock_timestamp())
          `,
          [`${fixture.claimId}-duplicate`, EXPENSE_MONTH, fixture.claimantId],
        ),
      { code: "23505", constraint: "uq_active_claim_user_month" },
    );

    await db.query(
      `
        UPDATE expense_claims
        SET status = 'CANCELLED', cancelled_at = clock_timestamp(), updated_at = clock_timestamp()
        WHERE id = $1
      `,
      [fixture.claimId],
    );

    await insertClaimAndDraftRevision(db, fixture, {
      claimId: `${fixture.claimId}-replacement`,
      revisionId: `${fixture.revisionId}-replacement`,
    });

    const active = await db.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM expense_claims
        WHERE user_id = $1 AND expense_month = $2::date AND cancelled_at IS NULL
      `,
      [fixture.claimantId, EXPENSE_MONTH],
    );
    expect(active.rows[0]?.count).toBe("1");
  });

  test("allows only one Draft MRC per department and month", async () => {
    const db = database();
    const fixture = newFixture("draft-mrc");
    const primaryMrcId = `${fixture.claimId}-mrc-primary`;
    const duplicateMrcId = `${fixture.claimId}-mrc-duplicate`;
    const replacementMrcId = `${fixture.claimId}-mrc-replacement`;
    await insertDepartmentAndUsers(db, fixture);

    const insertDraft = (id: string) =>
      db.query(
        `
          INSERT INTO monthly_request_collections (
            id, department_id, collector_id, collect_for_month,
            status, claim_count, count_dates, amount, snapshot_version,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4::date,
            'DRAFT', 0, 0, 0.00, 1,
            clock_timestamp(), clock_timestamp()
          )
        `,
        [id, fixture.departmentId, fixture.collectorId, EXPENSE_MONTH],
      );

    await insertDraft(primaryMrcId);
    await expectPgFailure(db, () => insertDraft(duplicateMrcId), {
      code: "23505",
      constraint: "uq_draft_mrc_department_month",
    });

    await db.query(
      `
        UPDATE monthly_request_collections
        SET status = 'CANCELLED',
            cancelled_at = clock_timestamp(),
            cancelled_by_id = $2,
            cancel_reason = 'ยกเลิกชุดทดสอบ',
            updated_at = clock_timestamp()
        WHERE id = $1
      `,
      [primaryMrcId, fixture.collectorId],
    );
    await insertDraft(replacementMrcId);

    const drafts = await db.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM monthly_request_collections
        WHERE department_id = $1
          AND collect_for_month = $2::date
          AND status = 'DRAFT'
      `,
      [fixture.departmentId, EXPENSE_MONTH],
    );
    expect(drafts.rows[0]?.count).toBe("1");
  });

  test("allows only one active replacement for an off-site-work record", async () => {
    const db = database();
    const fixture = newFixture("osw-replacement");
    await insertDepartmentAndUsers(db, fixture);
    await insertOffSiteWorkScope(db, fixture);

    const insertReplacement = (id: string) =>
      db.query(
        `
          INSERT INTO off_site_works (
            id, start_date, end_date, posted_by_user_id, posted_at, supersedes_id
          ) VALUES ($1, '2030-06-10'::date, '2030-06-10'::date, $2, clock_timestamp(), $3)
        `,
        [id, fixture.collectorId, fixture.offSiteWorkId],
      );
    const firstId = `${fixture.offSiteWorkId}-replacement-1`;
    await insertReplacement(firstId);
    await expectPgFailure(
      db,
      () => insertReplacement(`${fixture.offSiteWorkId}-replacement-2`),
      { code: "23505", constraint: "uq_active_osw_replacement" },
    );

    await db.query(
      `UPDATE off_site_works SET deleted_at = clock_timestamp() WHERE id = $1`,
      [firstId],
    );
    await insertReplacement(`${fixture.offSiteWorkId}-replacement-3`);
  });

  test("requires complete frozen fields on an active MRC item", async () => {
    const db = database();
    const fixture = newFixture("mrc-item-snapshot");
    await insertDepartmentAndUsers(db, fixture);
    await insertClaimAndDraftRevision(db, fixture);
    const mrcId = `${fixture.claimId}-mrc`;
    await db.query(
      `
        INSERT INTO monthly_request_collections (
          id, department_id, collector_id, collect_for_month,
          status, claim_count, count_dates, amount, snapshot_version,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4::date,
          'DRAFT', 0, 0, 0.00, 1,
          clock_timestamp(), clock_timestamp()
        )
      `,
      [mrcId, fixture.departmentId, fixture.collectorId, EXPENSE_MONTH],
    );

    await expectPgFailure(
      db,
      () =>
        db.query(
          `
            INSERT INTO monthly_request_collection_items (
              id, monthly_request_collection_id, expense_claim_id,
              claim_revision_id, added_by_id, added_at, row_no,
              employee_id_snapshot, first_name_snapshot, last_name_snapshot,
              position_short_snapshot, department_id_snapshot,
              department_name_snapshot, day_count_snapshot, amount_snapshot,
              created_at
            ) VALUES (
              $1, $2, $3,
              $4, $5, clock_timestamp(), 1,
              '000001', 'ผู้ขอ', 'ทดสอบ',
              NULL, $6,
              'ฝ่ายทดสอบ', 1, 150.00,
              clock_timestamp()
            )
          `,
          [
            `${fixture.claimId}-mrc-item`,
            mrcId,
            fixture.claimId,
            fixture.revisionId,
            fixture.collectorId,
            fixture.departmentId,
          ],
        ),
      { code: "23514", constraint: "ck_mrc_item_snapshot" },
    );
  });

  test("stores an incomplete We Safe code in Draft but rejects submission", async () => {
    const db = database();
    const fixture = newFixture("invalid-wesafe");
    await insertDepartmentAndUsers(db, fixture);
    await insertClaimAndDraftRevision(db, fixture);
    await insertOffSiteWorkScope(db, fixture);
    await insertWorkDate(db, fixture);

    await db.query(
      `
        INSERT INTO expense_claim_work_date_we_safe_codes (
          id, work_date_id, code, created_at
        ) VALUES ($1, $2, 'INCOMPLETE', clock_timestamp())
      `,
      [`it-code-${fixture.workDateId}`, fixture.workDateId],
    );

    const draftCode = await db.query<{ code: string }>(
      `SELECT code FROM expense_claim_work_date_we_safe_codes WHERE work_date_id = $1`,
      [fixture.workDateId],
    );
    expect(draftCode.rows[0]?.code).toBe("INCOMPLETE");

    await expectPgFailure(db, () => submitRevision(db, fixture.revisionId), {
      code: "P0001",
      messageIncludes: "submitted We Safe codes must contain exactly 19 characters",
    });
  });

  test("rejects submission when a required work date has no We Safe code", async () => {
    const db = database();
    const fixture = newFixture("missing-wesafe");
    await insertDepartmentAndUsers(db, fixture);
    await insertClaimAndDraftRevision(db, fixture);
    await insertOffSiteWorkScope(db, fixture);
    await insertWorkDate(db, fixture);

    await expectPgFailure(db, () => submitRevision(db, fixture.revisionId), {
      code: "P0001",
      messageIncludes: "every required work date must contain a We Safe code",
    });
  });

  test("allows duplicate valid 19-character We Safe codes on one work date", async () => {
    const db = database();
    const fixture = newFixture("duplicate-wesafe");
    await insertDepartmentAndUsers(db, fixture);
    await insertClaimAndDraftRevision(db, fixture);
    await insertOffSiteWorkScope(db, fixture);
    await insertWorkDate(db, fixture);

    await db.query(
      `
        INSERT INTO expense_claim_work_date_we_safe_codes (
          id, work_date_id, code, created_at
        ) VALUES
          ($1, $3, $4, clock_timestamp()),
          ($2, $3, $4, clock_timestamp())
      `,
      [
        `it-code-1-${fixture.workDateId}`,
        `it-code-2-${fixture.workDateId}`,
        fixture.workDateId,
        VALID_WE_SAFE_CODE,
      ],
    );
    await submitRevision(db, fixture.revisionId);

    const result = await db.query<{ code: string; status: string }>(
      `
        SELECT code.code, revision.status::text AS status
        FROM expense_claim_work_date_we_safe_codes code
        JOIN expense_claim_work_dates work_date ON work_date.id = code.work_date_id
        JOIN expense_claim_revisions revision ON revision.id = work_date.revision_id
        WHERE code.work_date_id = $1
        ORDER BY code.id
      `,
      [fixture.workDateId],
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.code)).toEqual([
      VALID_WE_SAFE_CODE,
      VALID_WE_SAFE_CODE,
    ]);
    expect(result.rows.every((row) => row.status === "SUBMITTED")).toBe(true);
  });

  test("cannot move a We Safe code out of a submitted revision", async () => {
    const db = database();
    const fixture = newFixture("immutable-old-owner");
    await insertDepartmentAndUsers(db, fixture);
    await insertClaimAndDraftRevision(db, fixture);
    await insertOffSiteWorkScope(db, fixture);
    await insertWorkDate(db, fixture);
    const codeId = `it-code-${fixture.workDateId}`;
    await db.query(
      `
        INSERT INTO expense_claim_work_date_we_safe_codes (
          id, work_date_id, code, created_at
        ) VALUES ($1, $2, $3, clock_timestamp())
      `,
      [codeId, fixture.workDateId, VALID_WE_SAFE_CODE],
    );
    await submitRevision(db, fixture.revisionId);

    const nextRevisionId = `${fixture.revisionId}-2`;
    const nextRevisionOffSiteWorkId = `${fixture.revisionOffSiteWorkId}-2`;
    const nextWorkDateId = `${fixture.workDateId}-2`;
    await db.query(
      `
        INSERT INTO expense_claim_revisions (
          id, expense_claim_id, revision_no, status,
          employee_id_snapshot, first_name_snapshot, last_name_snapshot,
          position_short_snapshot, department_id_snapshot, department_name_snapshot,
          rate_per_day, total_days, total_amount, created_at, updated_at
        ) VALUES (
          $1, $2, 2, 'DRAFT',
          '000001', 'ผู้ขอ', 'ทดสอบ',
          'วศก.', $3, 'ฝ่ายทดสอบ',
          150.00, 1, 150.00, clock_timestamp(), clock_timestamp()
        )
      `,
      [nextRevisionId, fixture.claimId, fixture.departmentId],
    );
    await db.query(
      `
        INSERT INTO expense_claim_revision_off_site_works (
          id, revision_id, off_site_work_id, inner_ref_document_id_snapshot,
          start_date_snapshot, end_date_snapshot,
          leader_first_name_snapshot, leader_last_name_snapshot, created_at
        ) VALUES (
          $1, $2, $3, 'OSW-REVISION-2',
          '2030-06-10'::date, '2030-06-10'::date,
          'หัวหน้า', 'ทดสอบ', clock_timestamp()
        )
      `,
      [nextRevisionOffSiteWorkId, nextRevisionId, fixture.offSiteWorkId],
    );
    await db.query(
      `
        INSERT INTO expense_claim_work_dates (
          id, revision_id, revision_off_site_work_id, work_date,
          day_type, holiday_type, holiday_source, requires_we_safe,
          daily_rate, created_at
        ) VALUES (
          $1, $2, $3, '2030-06-10'::date,
          'TRAVEL', 'WORKDAY', 'GOOGLE', true,
          150.00, clock_timestamp()
        )
      `,
      [nextWorkDateId, nextRevisionId, nextRevisionOffSiteWorkId],
    );

    await expectPgFailure(
      db,
      () =>
        db.query(
          `
            UPDATE expense_claim_work_date_we_safe_codes
            SET work_date_id = $2
            WHERE id = $1
          `,
          [codeId, nextWorkDateId],
        ),
      {
        code: "P0001",
        messageIncludes: "submitted or superseded revision snapshots are immutable",
      },
    );
  });

  test("rejects a work date outside its expense month", async () => {
    const db = database();
    const fixture = newFixture("outside-month");
    await insertDepartmentAndUsers(db, fixture);
    await insertClaimAndDraftRevision(db, fixture);
    await insertOffSiteWorkScope(db, fixture, {
      startDate: "2030-06-30",
      endDate: "2030-07-02",
    });

    await expectPgFailure(
      db,
      () =>
        insertWorkDate(db, fixture, {
          workDate: "2030-07-01",
          dayType: "DUTY",
          requiresWeSafe: false,
        }),
      {
        code: "P0001",
        messageIncludes: "work date is outside expense month",
      },
    );
  });

  test("rejects a work date outside its primary OSW range", async () => {
    const db = database();
    const fixture = newFixture("outside-osw");
    await insertDepartmentAndUsers(db, fixture);
    await insertClaimAndDraftRevision(db, fixture);
    await insertOffSiteWorkScope(db, fixture, {
      startDate: "2030-06-10",
      endDate: "2030-06-12",
    });

    await expectPgFailure(
      db,
      () =>
        insertWorkDate(db, fixture, {
          workDate: "2030-06-13",
          dayType: "DUTY",
          requiresWeSafe: false,
        }),
      {
        code: "P0001",
        messageIncludes: "work date is outside OSW snapshot range",
      },
    );
  });

  test("rejects a work date when the claimant is not an OSW participant", async () => {
    const db = database();
    const fixture = newFixture("nonparticipant");
    await insertDepartmentAndUsers(db, fixture);
    await insertClaimAndDraftRevision(db, fixture);
    await insertOffSiteWorkScope(db, fixture, { includeClaimant: false });

    await expectPgFailure(db, () => insertWorkDate(db, fixture), {
      code: "P0001",
      messageIncludes: "claimant is not an OSW participant",
    });
  });

  test("keeps review flags append-only while allowing OPEN to RESOLVED", async () => {
    const db = database();
    const fixture = newFixture("review-flag");
    await insertDepartmentAndUsers(db, fixture);
    await insertClaimAndDraftRevision(db, fixture);
    const flagId = `it-flag-${fixture.claimId}`;

    await db.query(
      `
        INSERT INTO claim_review_flags (
          id, expense_claim_id, status, note, opened_by_id, opened_at
        ) VALUES ($1, $2, 'OPEN', 'ตรวจสอบข้อมูลเพิ่มเติม', $3, clock_timestamp())
      `,
      [flagId, fixture.claimId, fixture.collectorId],
    );

    await db.query(
      `
        UPDATE claim_review_flags
        SET status = 'RESOLVED',
            resolution_note = 'ตรวจสอบแล้วถูกต้อง',
            resolved_by_id = $2,
            resolved_at = clock_timestamp()
        WHERE id = $1
      `,
      [flagId, fixture.collectorId],
    );

    const resolved = await db.query<{
      status: string;
      note: string;
      resolutionNote: string | null;
    }>(
      `
        SELECT
          status::text AS status,
          note,
          resolution_note AS "resolutionNote"
        FROM claim_review_flags
        WHERE id = $1
      `,
      [flagId],
    );
    expect(resolved.rows[0]).toEqual({
      status: "RESOLVED",
      note: "ตรวจสอบข้อมูลเพิ่มเติม",
      resolutionNote: "ตรวจสอบแล้วถูกต้อง",
    });

    await expectPgFailure(
      db,
      () =>
        db.query(`UPDATE claim_review_flags SET note = 'แก้ประวัติ' WHERE id = $1`, [
          flagId,
        ]),
      {
        code: "P0001",
        messageIncludes: "only resolving an open claim review flag is allowed",
      },
    );

    await expectPgFailure(
      db,
      () => db.query(`DELETE FROM claim_review_flags WHERE id = $1`, [flagId]),
      {
        code: "P0001",
        messageIncludes: "claim review flags are append-only",
      },
    );
  });
});
