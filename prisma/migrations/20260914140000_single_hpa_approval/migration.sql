BEGIN;

-- This cutover assumes there are no signed documents from the old workflow.
-- Refuse to silently rewrite or discard existing approvals.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM mrc_approval_steps
    WHERE stage <> 'HPA_CHECK' OR status = 'APPROVED'
  ) THEN
    RAISE EXCEPTION 'MRC cutover blocked: existing legacy approvals require review before migration. No documents were changed.';
  END IF;
END $$;

ALTER TABLE mrc_approval_steps
  ADD COLUMN signature_data BYTEA,
  ADD COLUMN reviewer_name_at_approval TEXT,
  ADD COLUMN reviewer_position_at_approval TEXT;

-- Retain deprecated database enum values; remove their effective grants.
DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT id FROM permissions
  WHERE resource = 'MONTHLY_REQUEST' AND action IN ('REVIEW_RK', 'REVIEW_OK')
);
UPDATE permissions SET is_active = false, updated_at = NOW()
WHERE resource = 'MONTHLY_REQUEST' AND action IN ('REVIEW_RK', 'REVIEW_OK');

DELETE FROM role_permissions rp USING roles r, permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id
  AND r.code IN ('rk', 'drt') AND p.resource = 'MONTHLY_REQUEST'
  AND p.action IN ('SUBMIT', 'APPROVE');

UPDATE roles SET description = 'อ่านรายงานรวบรวมที่อนุมัติแล้ว — ลงนามในระบบเอกสารขององค์กร', updated_at = NOW()
WHERE code IN ('rk', 'drt');
UPDATE roles SET description = 'ผู้อนุมัติและลงนามรายงานรวบรวมรายเดือน — หัวหน้าแผนก', updated_at = NOW()
WHERE code = 'hpa';
UPDATE permissions SET name = 'Approve and Sign Monthly Requests — HPA', updated_at = NOW()
WHERE code = 'monthly-request:review:hpa';

COMMIT;
