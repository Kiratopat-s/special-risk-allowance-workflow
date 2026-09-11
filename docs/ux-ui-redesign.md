# SRAW redesign implementation and review

Implemented against the approved `public/ux-ui-demo.html` concept on 11 September 2026. The production application uses TypeScript components and authenticated reads; the HTML concept remains a separate review artifact.

## Local review

Run `bun devh`, then open https://local.sraw.space:3000/dashboard with the existing local authentication setup. The dashboard now opens the overview by default. Existing tab URLs, legacy redirects, claim links, notification destinations, and sign-in callbacks remain supported. Nothing was deployed and no schema migration was added.

## Application coverage

| Area | Integrated presentation and retained operations |
| --- | --- |
| Foundation | Ink desktop sidebar, mobile navigation drawer, warm red actions, local Manrope and Noto Sans Thai, light/dark schemes, route-aware public header and print isolation. |
| Overview | Authorized monthly aggregates, requested and approved amounts, complete status counts, permission-aware next actions, recent claims, and real collection approval steps. Empty, restricted, and failed reads have distinct states. |
| Claims | MUI document table, URL search/status/month/amount sort/pagination, authorized detail drawer and deep links, three-step creation/draft editor, individual calendar dates, separate non-draft editor, owner-only draft submission and cancellation controls. |
| Off-site work | Searchable document table and drawers/dialogs retaining references, employees, assigned leaders, work dates, and existing linked-claim restrictions. |
| Monthly collections | Search/status/month/pagination, eligible-claim selection, creation/editing, submission, exact-stage reviews, rejection remarks, cancellation and original print links. |
| Verification and signatures | Internal queue and token-based external screen; existing optional verification signatures, drawing canvas, history, activation, redraw, deletion and download remain in place. |
| Administration | Roles and inheritance, scoped permissions, user assignments, departments, and system notification operations use the shared presentation. Existing validation and server actions remain authoritative. |
| Account/public | Profile editing and synchronization, MUI notification popover, local sign-in, landing/help illustrations, privacy and terms. Legal text is unchanged. Keycloak's hosted login is outside this repository. |

## Implementation boundaries

- MUI 7.3.5 and its App Router adapter, Emotion 11, and Motion 12 are installed. Existing Next.js, React, Tailwind and Bun versions remain unchanged.
- `components/workflow-ui` provides shared MUI controls alongside the original primitives. Tailwind handles layout and responsive styling. Lucide and Sonner remain in use.
- MUI owns color-scheme state with the existing `theme` storage key, `.dark` selector and light default. The App Router cache provider enables CSS layers ordered `theme, base, mui, components, utilities`.
- React Bits CountUp and SpotlightCard are adapted locally with source/license attribution. They are used only on the overview. Final amounts remain available to assistive technology; reduced motion skips the animations.
- Overview access follows `app/actions/dashboard.ts → lib/domains/dashboard/service.ts → repository.ts`. The repository aggregates the complete authorized monthly set before limiting recent rows. Requested totals include drafts and rejected claims under the existing non-cancelled filter; approved totals are separate.
- Claim read scoping is shared with the existing list action. Optional grouped-status and amount-order filters are additive; a specific status takes precedence. Omitted filters retain legacy ordering and scope. Filters are applied in repository queries before pagination.
- Existing mutation action contracts and domain mutation implementations remain unchanged. UI payload/date helpers were relocated with regression coverage. Successful mutations refresh server data; filters and page context remain in the URL. Pending requests disable submission/closing, and transport errors retain form values.
- The official print page, print controls, THSarabun font files, Prisma schema/migrations, authentication, workflow mutation services, notifications/email/SSE/push/service-worker implementations have no business-policy changes. The root shell does not render workspace chrome on official print routes.

## Verification

The starting suite contained 159 passing tests across 11 files. The expanded suite contains 244 tests across 25 files.

| Check | Result |
| --- | --- |
| `bun run test` | Passed: 244 tests across 25 files. |
| `bun run lint` | Passed; only the existing outdated Browserslist-data advisory. |
| `bunx tsc --noEmit` | Passed. |
| `bun run build` | Attempted twice; this execution environment rejects the Turbopack worker's port binding with `Operation not permitted`. |
| `bun run build --webpack` | Production build verified with Next.js's supported webpack alternative. The normal package build script is unchanged. |
| Browser | Authenticated local app reviewed in Chrome, both themes, 390 px phone, 768 px tablet, and desktop. Overview/monthly workspace also checked at 200% browser zoom without page overflow. |
| Keyboard/history | Claim dialog focus containment, Escape close and focus restoration; URL filters survive reload and browser back navigation. Theme persists through reload. |
| Print regression | Original print component rendered with isolated fixtures for 0, 12, 13, 34, 35, 56 and 57 rows. Tests check page distribution, totals, row order, saved positions, A4/THSarabun styles, permission gating, and active signatures on the final page. Official print sources/fonts are unchanged. |

New coverage includes overlapping and clipped dates, weekend/weekday fallback, saved draft dates, exact create/edit payloads, non-draft/rejected behavior, missing leaders, owner-only submission, deep-link READ checks, server and transport errors, pending-submit protection, OWN/ALL overview scoping, mixed-role collection visibility, stage order, exact action guards, signature requirements, all three collection-eligible statuses, and reduced-motion accents. Existing service regressions continue to cover workflow transitions and side effects.

Browser work was read-only apart from temporary theme/zoom settings and opening unsaved forms. All tested mutations used mocked actions or isolated repository fixtures. The local database had no work, claim or collection records, so populated workflows were exercised in component/domain fixtures rather than by creating real records.

## Validation limits

- A browser-rendered PDF or physical printer comparison against a saved baseline was not completed. The print evidence is unchanged source/font files plus isolated rendering assertions at pagination boundaries; it does not claim pixel-identical output on every printer.
- The browser check used its page/text zoom control at 200%; a separate operating-system text-size setting was not changed.
- Multi-account Keycloak sessions, actual expired-session redirects, delivered email/push notifications, and externally received token links were not exercised against live services. Their business implementations remain unchanged and available regression tests use mocks.
- Browser checks cover representative layouts and controls, not every populated role/screen/theme combination. Full production acceptance should include those populated scenarios in an isolated staging environment.

See `redesign-existing-behavior.md` for pre-existing behavior discovered during the migration and the narrowly scoped presentation fixes.

## Integration references

- [MUI App Router integration](https://mui.com/material-ui/integrations/nextjs/)
- [MUI and Tailwind v4 layers](https://mui.com/material-ui/integrations/tailwindcss/tailwindcss-v4/)
- [React Bits SpotlightCard](https://reactbits.dev/components/spotlight-card)
- [React Bits CountUp](https://reactbits.dev/text-animations/count-up)

