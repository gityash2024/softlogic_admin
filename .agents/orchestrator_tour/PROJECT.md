# Project: App Tour Extension
# Scope: Global

## Architecture
- `TourProvider.tsx` manages tour state and UI overlay.
- Various components (Organizations, Users, Mail, Licensing, AI Module) need targetable elements (IDs or classes) that `TourProvider.tsx` can highlight.
- Step transitions in `TourProvider.tsx` may need to include React Router navigation logic (`navigate` from `react-router-dom`) when the route of the next step is different.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Explore | Find `TourProvider.tsx`, identify components to add targets, map out 25+ steps. | none | DONE |
| 2 | Implementation | Update `TourProvider.tsx` with 25+ steps, navigation logic, and add target IDs/refs to all relevant components. | M1 | IN_PROGRESS |
| 3 | Review & Verify | Review changes, verify no external libraries added, test build. | M2 | PLANNED |

## Interface Contracts
### TourProvider ↔ Router
- `TourProvider` will check the expected route of the next step and trigger a route change if it differs from current. Wait for route to render before highlighting the target.
