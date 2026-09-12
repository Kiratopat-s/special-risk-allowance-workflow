# UI alignment fixes — 12 September 2026

Implemented the approved cosmetic fixes without changing server actions, authorization, workflow transitions, date calculations, adaptive picker behavior, dependencies, schema, or official print templates. Legal-page changes only remove redundant button-icon margins; their wording is unchanged.

## Before and after

The before column records the approved browser audit and supplied screenshot. After measurements come from Chrome with the updated application and isolated populated fixtures. Screenshots were captured in the implementation task for the roles screen, both tables, permissions, signatures, system notifications, the notification popover, and dialogs.

| Area | Before | Verified after |
| --- | --- | --- |
| Role permissions | 38 px MUI control in a 14 px wrapper; nested labels; approximately 7 px text overlap | MUI control occupies its full 38 px width, followed by an 8 px gap. No nested labels. Labels wrap and scope badges retain their width. Columns use the panel's available width with a 22 rem minimum. |
| Search fields | Separately positioned icons obscured by input backgrounds | Icons are inside MUI `InputAdornment` on roles, users, departments, permissions, claims, and off-site work. Existing input and search handlers remain intact. |
| Users table | Action clipped at 390 px | 576 px table scrolls inside a 356 px container, without page overflow. Keyboard navigation brings the assignment button into view; its right edge measured 361 px in the 390 px viewport. |
| Department names | Narrow columns stacked Thai characters | Name columns are at least 224 px. The populated long-name fixture measured 380 px at phone width. The table scrolls to its actions. |
| Permission toolbars and rows | Horizontal controls and truncated labels cramped narrow screens | Search occupies its own row when needed; complete permission names and codes wrap, with visible scope badges. |
| Signatures and system notifications | Feature padding duplicated application padding | Both embedded feature roots have zero padding and align at x=16 px in the 390 px application viewport. Intentional maximum content widths remain. |
| Icon actions | Unnamed actions, duplicated spacing, invisible focused role removal | Named icon-button variants, visible keyboard outlines, and role-removal controls visible on focus. Redundant margins inside buttons removed. |
| Dialogs | Desktop header padding could collide with the close control | 8 px separation between the long title box and close button; header/footer stay visible while only the body scrolls. Verified at 390 px and actual Chrome 200% zoom. |
| Notifications | MUI menu rows defaulted to non-wrapping text | Long Thai and unbroken reference text wrap within the popover. Body preview remains two lines. No horizontal overflow; header actions remain reachable. |

An additional fixture finding was corrected: a long list of user role badges could overflow the row because only the Radix root had a maximum height. The viewport now shares the 96 px limit. Its 182 px content scrolls internally; the table container's height and scroll height both remain 170 px. Keyboard focus scrolls each removal control into view.

## Browser verification

- Populated roles, users, departments, and permissions: **390, 768, 1280, and 1920 px**, in both light and dark themes. No page-level horizontal overflow; table overflow is confined to its container.
- Integrated application: roles in both themes, mobile users/departments, mobile signature/system-notification gutters, and claims/off-site search fields at 768 px.
- Keyboard component tests and browser checks: checkbox label activation and Space, role-removal visibility, assignment-action reachability, dialog Escape dismissal and focus restoration, dropdown navigation and dismissal.
- Actual Chrome **200% zoom** (1280 × 960 browser viewport, 640 × 480 CSS viewport): long dialog, notification popover, and month picker above the collection dialog. The month picker remained within x=44–366 and y=130–468.
- Populated collection fixture: selecting one checkbox selects one claim, without also toggling its row. All three existing eligible statuses remain represented.
- No browser console warnings/errors were captured during the final integrated roles review. Original dark theme and temporary viewport/zoom settings were restored afterward.

These are desktop Chrome breakpoint checks, not physical phone/tablet testing. Existing automated adaptive-picker tests continue to cover native touch controls and capability changes. No live workflow mutation was exercised.

## Repeatable populated fixtures

Run `bun tests/visual/serve-ui-alignment.mjs`, then open `http://127.0.0.1:4186/`.

This test-only preview renders the actual feature components with long Thai names, multiple role badges, permissions, notifications, and eligible collection claims. Server actions and notification hooks are replaced with local mocks; saving returns a fixture error. It does not add a Next.js route or production dependency. Temporary build files are written outside the repository.

## Regression results

| Check | Result |
| --- | --- |
| `bun run test` | **288 tests passed across 30 files** |
| `bun run lint` | Passed; existing stale Browserslist-data warning |
| `bunx tsc --noEmit --incremental false` | Passed |
| `bun run build` | Existing sandbox restriction: Turbopack CSS worker cannot bind a port (`EPERM`) |
| `bun run build --webpack` | Passed, including TypeScript and all 26 static pages |
| `git diff --check` | Passed |

Focused additions cover single checkbox callbacks, external and internal labels, disabled states, unchanged permission IDs and collection payloads, pending/error selection retention, search URL parameters and pagination resets, named admin actions, dialog focus restoration, and notification removal without triggering read/navigation behavior.

An earlier test run passed all assertions but reported a Vitest teardown RPC error. Subsequent full runs, including the final run after the role-badge fix, exited successfully.
