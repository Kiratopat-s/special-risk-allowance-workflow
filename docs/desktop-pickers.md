# Adaptive dropdowns and date pickers

Implemented 11 September 2026. Desktop controls use MUI menus and calendar popovers when `(hover: hover) and (pointer: fine)` matches. Touch-first devices retain native select/month/date controls. SSR and the initial hydration render share the native fallback; capability changes preserve the selected value, dismiss open popovers, and do not emit changes.

The shared dropdown uses string option values and `onValueChange`. The date control uses `YYYY-MM` or `YYYY-MM-DD` strings, Thai calendar labels, Gregorian years, and explicit UTC parsing. Existing searchable Autocomplete controls are unchanged. MUI X 8.17.0 and Day.js 1.11.18 are pinned; existing core framework versions and the single theme controller are unchanged.

The overview, claim filters/editor, collection filters/editor, and off-site work date fields use the new controls. URL filters commit completed calendar selections or valid keyboard edits on blur. Incomplete filter edits stay local; incomplete form edits clear the canonical value so an old value cannot silently be submitted. Optional filters have explicit clear buttons. The existing claim day-selection calendar, server interfaces, permissions, mutation payloads, calculations, and print files are unchanged.

Calendar validation does not inherit MUI's default 1900–2099 bounds. The four-digit ISO year range is available, with the year view paged in groups of 80 to avoid rendering thousands of buttons. Popovers account for available viewport space, stack above workflow dialogs, and scroll when necessary.

## Verification

- `bun run test`: 275 tests passed across 27 files, including the existing workflow and print regression tests.
- `bun run lint` and `bunx tsc --noEmit`: passed. Lint retains the existing Browserslist-data advisory.
- Date serialization suite: all 15 cases passed separately under `TZ=UTC` and `TZ=Asia/Bangkok`.
- `bun run build`: the existing Turbopack worker-port restriction still fails with `Operation not permitted` in this environment.
- `bun run build --webpack`: production build passed.
- Chrome: custom status menus, Thai month/year selection, URL updates and clearing, both themes, calendar focus inside a workflow dialog, Escape focus restoration, narrow layouts, and 200% zoom/viewport-edge positioning reviewed. No live business mutations were submitted.
- Automated interaction tests cover native touch controls, runtime capability switching, SSR hydration, disabled options, keyboard/typeahead behavior, incomplete edits, clearing, year paging, date selection, and unchanged claim filter URLs. Physical phone/tablet hardware was not used.

The approved standalone HTML concept remains unchanged.

## Separate environment observation

During the final reload, the existing Auth.js session reported `JWTSessionError / Invalid Compact JWE`. Normal Keycloak sign-in restored access. Authentication and cookie handling were not changed as part of the picker work.
