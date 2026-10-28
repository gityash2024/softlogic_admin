# Phase 2 session stability — 28 October 2026

This delivery supersedes the Windows build, reference timeout and release-path details in `PHASE2_COMPLETION_20261027.md`. The earlier profanity hierarchy, master AI switch and audited pool correction remain in place. Only AWS Phase 2 was deployed; production, Phase 1, DigitalOcean and Vercel were not changed by this delivery.

## Repairs

- The Phase 2 profanity response interceptor widened JSON objects to `Map<dynamic, dynamic>`. Dio callers expecting `Map<String, dynamic>` then rejected valid tier-preference and reference responses. The shared masking helper now preserves typed JSON maps, including nested objects and protected URLs. Each shared Dio client receives the interceptor once.
- Free reference attachment and transport now allow 45 seconds. Cold authenticated reference checks measured 12.783–22.840 seconds in the final six-user run; cached checks measured 62–3621 ms. All 18 requests returned relevant references. These measurements concern reference retrieval, not Qwen inference capacity. Pro generation deadlines are unchanged. No unavailable-reference banner was added, and failed reference discovery does not discard the answer or invent links.
- A stale Pro choice from an account without usable Pro credit normalizes to Free when Free is available. The existing disabled Pro option explains the missing credit. Superadmin internal unlimited access remains exempt, and global Free-only/Pro-only controls still apply.
- Google provider HTTP 402 prepaid-balance failures are distinguished from customer application-credit failures. Existing fallback remains available without telling a Superadmin to purchase application credits. No credit mathematics or provider credentials changed.
- The Windows build now sets the same brand for native CMake resources and Dart. `tool/build_phase2_windows.ps1` validates native ProductName and fails on a mismatch. AI Smart Board 1.0.40+40 has the correct executable, native title, icon and Dart brand; no renamed SoftLogic launcher is used.

## Provider billing recheck

On 27 October the configured Phase 2 Pro key returned Google HTTP 402, stating that prepayment credits were depleted. On 28 October the user supplied a funded billing-account screenshot. A fresh request through the deployed Phase 2 service, using its existing configured key and `gemini-3.5-flash`, succeeded and returned candidates. Another recharge is not indicated by that current test. This does not claim that a billing-account screenshot alone proves which project/key is funded. No billing settings, keys or production configuration were edited.

## Verification

- Backend: release build passed; 32 focused tier-router, resolver and Superadmin tests passed. These add coverage to the earlier 112 reference, profanity, financial and compatibility checks.
- Flutter: the actual Phase 2 interceptor was enabled with `--dart-define=APP_ENV=phase2`; 31 tests passed across shared transport, references, tier sessions, hub menus, profanity and branding. The final focused transport/menu run passed 8 tests, including duplicate-interceptor prevention and the no-Pro-credit explanation.
- Admin: the earlier 30 checks and TypeScript/Vite build passed; finite platform pools were inspected in the running local UI. No further admin UI changes were needed for the transport repair.
- Live API: authenticated Free → Pro → Free preference writes returned HTTP 200 with preserved Superadmin exemption and Pro usability.
- The Phase 2 process is online in database `softlogic_phase2`. Production PID and AI service fingerprint were verified unchanged.
- The previous full Flutter analysis reported zero errors with existing warnings/informational findings; unrelated lint cleanup was excluded. Windows release compilation passed after the final code repairs.

## Deployment and rollback

- Current backend: `/opt/softlogic-phase2/releases/phase2-20261027-session-stability`.
- Code/config backup: `/opt/softlogic-phase2/backups/session-stability-20261027`.
- Existing database/financial backup: `/opt/softlogic-phase2/backups/reference-pools-20261027T140121Z`; original profanity migration backup: `/opt/softlogic-phase2/backups/profanity-20261026T170911Z`.
- Windows folder: `C:/Users/YashJangid/Desktop/yash/phase2_release/20261027-session-stability`.
- App environment: Phase 2 API; local admin `http://localhost:5173`.

For code rollback, restore the previous release recorded in the session-stability backup using the existing guarded Phase 2 rollback helper and verify health. Roll back only `softlogic-phase2-api` in `/opt/softlogic-phase2/.pm2`; preserve production. No database migration was added for these latest fixes. Do not restore a database or reverse the intentional platform-credit conversion for an ordinary code rollback.

## Owner acceptance

1. Verify AI Smart Board title/icon, then switch Free → Pro → Free repeatedly. Inputs should remain; old generated previews and errors should clear.
2. Generate photosynthesis and Pythagoras in Free and Pro. Confirm relevant references, enabled insertion and fresh output after switching. Test Session Insights on actual board text as well.
3. Check a normal zero-Pro-credit user sees the existing disabled Pro explanation and can continue with Free; Superadmin retains both internal modes.
4. In the existing admin master switch, verify Free-only, Pro-only and Both propagate to the app. Check finite platform pools separately from Superadmin unlimited inference access.
5. Repeat the earlier profanity checklist in `PHASE2_PROFANITY_AND_AI_MODE_20261026.md`: inherited locks, custom words/case/camelCase/Unicode, board/paste/chat/prompts/output/save/reopen/export, and offline bypass.
6. Repeat IME/recognised-handwriting and layout interactions on Android hardware. Unrecognised ink, excluded media pixels/audio and external-source outages retain their documented limits. Automated checks do not provide universal detection or production launch approval.
