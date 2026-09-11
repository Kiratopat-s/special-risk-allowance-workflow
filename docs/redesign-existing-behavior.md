# Existing behavior discovered during the redesign

These observations are separate from the visual redesign. They are not new business policies.

## Retained server behavior

1. **Monthly collection stage visibility is filtered after the legacy list query paginates.** A reviewer can therefore receive a short/empty page while pagination metadata counts records that are not yet visible to that reviewer. The original list behavior remains; the new overview applies the equivalent visibility predicate in the database before its count and recent-row limit. Changing legacy list totals/pagination should be a separate, explicit change with role fixtures.
2. **Authorization has existing scope and MANAGE fallback semantics.** UI action visibility follows those semantics, including the current handling of non-OWN scopes and exact action matches. The redesign does not introduce department-level policy or broaden server access. Stage reviews still require exact stage permissions and the existing super-admin exceptions.
3. **Rejected claims are not drafts.** Their permitted non-draft fields can be edited under existing authorization; no resubmission transition was added. Cancelled and legacy PENDING states remain represented.
4. **Collection eligibility includes unverified work.** The service accepts eligible PENDING, PENDING_LEADER_VERIFY and WAIT_FOR_COLLECTION claims, including its existing legacy-link handling. Verification state is informative and does not create a new collection prerequisite.

## Presentation fixes included

- The previous collection picker disabled claims without completed leader verification despite the service accepting them. The picker now permits the service-returned eligible claims, as explicitly required by the approved plan. The service and mutation contract did not change.
- Opening an existing draft previously replaced its saved individual date selection with weekday defaults. The editor now restores saved selected dates; records with no saved selection retain the existing default/fallback calculation. Submitted payloads and the 150-per-selected-day rule are covered by tests.
- The previous submit-success toast checked PENDING even though the create flow submits PENDING_LEADER_VERIFY. The message now reflects the actual save/submit action.
- After successful creation, the list stays on its current URL page/filter context. A server refresh no longer leaves the URL pointing to one page while local state displays page one.
- Shared permission state avoids a fresh permission-loading flash when opening mobile navigation. It refreshes on route changes and window focus; server checks remain the enforcement boundary.

## Environment observations

- The normal Turbopack production build cannot bind its worker port in this execution environment. Compilation and production output are checked with `bun run build --webpack`; no package-script or deployment change is included.
- Next.js dev automatically appends its generated agent-guidance block to AGENTS.md. That generated guidance is unrelated to business behavior.
