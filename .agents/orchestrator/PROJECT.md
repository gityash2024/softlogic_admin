# Project: Dual-Layer Custom App Tour
# Scope: admin_panel_softlogic

## Architecture
- **Tour State**: Custom `TourContext` in `src/components/tour/TourProvider.tsx`.
- **Tour Steps Definitions**: Profiles managed in `src/lib/tour-steps.ts` (e.g. `initial`, `organizations`, `users`, `license`, `ai`).
- **Floating Button**: `src/components/tour/FloatingTourTrigger.tsx` injected at the layout level via `TourProvider.tsx`.
- **UI Element**: Custom SVG/box-shadow overlay for highlighting elements without external libraries.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Prepare & Cleanup | Remove `react-joyride` from `package.json` and investigate current unstaged codebase | none | DONE |
| 2 | Refine Initial Tour | Expand the current 6-step initial profile in `tour-steps.ts` to exactly 9 top-level steps, concluding with a suggestion to use module tours | M1 | DONE |
| 3 | Detailed Module Tours | Ensure complete detailed tours are defined for Organizations, Users, Licensing, and AI in `tour-steps.ts` | M2 | DONE |
| 4 | Floating Trigger Logic | Ensure `FloatingTourTrigger` launches the relevant tour based on the active route, plus option for the initial tour replay | M3 | DONE |
| 5 | Verify & Build | Run build, check TS errors, and ensure functional UI without external libraries | M4 | DONE |

## Interface Contracts
### `TourProvider` ↔ `FloatingTourTrigger`
- The `FloatingTourTrigger` must be able to call `startTour(profile)` where `profile` is derived from the current URL path or user selection.
