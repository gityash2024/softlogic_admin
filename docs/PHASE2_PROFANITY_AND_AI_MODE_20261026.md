# Phase 2 profanity and platform AI mode â€” 26 October 2026

Implemented online Phase 2 only. Production, AWS Phase 1, DigitalOcean staging and Vercel UAT were not deployed. Navigation, tool layouts and credit/payment calculations remain unchanged.

## Delivered behavior

- Effective profanity policy: Global â†’ ancestor organisations â†’ current organisation â†’ enabled personal additions. Parent restrictions cannot be disabled by a child. Superadmin can manage global/org policy; existing subtree permissions govern org administrators. Guests inherit the authorised live session.
- Existing Flutter settings page gains Global scope for Superadmin and locked inherited entries. Dictionary editing remains exempt. Web admin changes are solely the separately requested master AI switch.
- Shared backend/Flutter fixture covers black/PIG/Modi, case, camelCase, Hindi, zero-width characters, separators, phrases, harmless longer words and protected URLs. Mask format retains the first character, e.g. black â†’ b****.
- Inputs: completed board text, paste, edit/rename, table cells, template/sticky/diagram labels, recognised handwriting/speech, chat and AI prompt submission. Projection protects restored boards, undo/redo, AI previews, copy/share/export and insertion without rewriting IDs or URLs.
- Server checks AI provider intake and textual output, SSE suffixes/structured fields, references, REST/socket chat, textual board events, snapshots, canvas and slides. Policy additions during streaming recheck retained/future output. Already delivered text is refreshed by connected client policy updates.
- Offline editing/generation bypasses the new enforcement. Preloaded/external libraries and uploaded/generated media pixels/audio are excluded. Existing Android handwriting recognition masks completed recognised words; unrecognised ink, unsupported recognition on Windows and recognition errors cannot be guaranteed. No paid scanning service was added.
- Superadmin AI â†’ Tiers: Master AI switch has Both, Free only, Pro only. It reuses proGloballyEnabled/freeEnabled; no AI-mode migration. Disabled tiers override stale request/saved preferences. Auto and switching controls appear only when both are enabled. Single-mode app settings hide the disabled-tier balance. Existing account permissions and funding still apply; this switch does not grant access or move credits.
- Socket invalidation refreshes connected Phase 2 apps/admin immediately; app has a 30-second refresh fallback. Reconnection refreshes policies/status. Phase 1 dormant tier behavior remains unchanged.

## Verification

- Backend: build passed; 112 regression tests passed across 14 suites, plus 5 focused master-mode persistence checks (filter, hierarchy, AI streaming, routing, pricing, settings, canvas and live sessions).
- Flutter: 45 final Phase 2 tests passed, including desktop/phone settings and single-tier selector rendering. Earlier broader checks: 110 regressions plus 200 focused tests (10 existing skips). Analyzer has no errors; existing repository warnings/info remain.
- Admin: TypeScript/Vite build passed; 29 Phase 2 checks passed, including rendering the actual master Select and checking all three submitted flag pairs.
- Deployed Phase 2: 36 isolated HTTP/socket assertions passed. Covered hierarchy, child-off protection, cross-scope denial, unrelated JSON preservation, canvas save/reopen, REST/socket chat, snapshot/board events, master-control authorisation and app status. Disposable fixtures were removed. Customer balances were untouched. No external provider spend was required for these checks.
- Phase 2 and production health endpoints returned HTTP 200. Production process PID and AI service hash remained unchanged.
- Windows 1.0.40+40 built for AI Smart Board, APP_ENV=phase2 and https://phase2-api.mymultimeds.com/api/v1. Local process path verified in the dedicated release directory. Native welcome screen rendered; interactive signed-in/hardware acceptance remains an owner check.

## Deployment and rollback

Active Phase 2 release: /opt/softlogic-phase2/releases/phase2-20261026-profanity
Process: softlogicphase2 / softlogic-phase2-api; database softlogic_phase2.
Migration: 20261026100000_phase2_profanity_policy (additive global table).
The guarded seed retained existing lists; no enabled legacy admin source lists were found in this Phase 2 database. No production lists were copied.
Database/configuration backup is the profanity-* folder under /opt/softlogic-phase2/backups; the precise folder is /opt/softlogic-phase2/backups/profanity-20261026T170911Z (also recorded in the local release manifest). It includes database.dump, pm2-before.json and previous-release.txt with restricted access.

Code rollback: run `sudo python3 /tmp/rollback-phase2-profanity.py <recorded-backup-folder>` on AWS, then verify Phase 2 health. This restores only the prior Phase 2 process/release/environment. The additive table and policy data remain. Do not restore the full database during normal code rollback; that would discard subsequent user work. Database restoration requires a separately coordinated maintenance window.

The deployment stripped inherited NODE_CHANNEL_FD/serialization values from one-off processes. PM2 retained an old cwd on reload, so the service was re-created from the verified release configuration. Production was unaffected.

## Owner test flow

1. Sign into the local app and localhost:5173 admin against Phase 2.
2. In existing Flutter profanity settings, add black/PIG/Modi at the intended Global or org scope. Verify lowercase, uppercase, blackBoard, paste, table/sticky labels, recognised speech/handwriting and chat. A child should show inherited entries locked.
3. Generate Smart Assist/quiz/flashcards in Free and Pro. Confirm masked human text, valid structured controls, clickable unchanged reference URLs and intact image/audio handling.
4. Save/reopen, undo/redo, copy and export. Reconnect after changing policy. Test offline bypass separately.
5. In admin AI â†’ Tiers choose Free only and Save: connected app hides Pro/Auto selector and uses Free. Choose Pro only: hides Free/Auto and uses Pro for entitled/funded accounts. Choose Both: selector returns. Existing balances/history stay intact. Restore the desired mode after testing.
6. Repeat keyboard/IME, handwriting and text layout checks on the Android whiteboard. Recognition/hardware acceptance is not claimed from desktop automated tests.
