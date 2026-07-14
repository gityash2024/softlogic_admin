# Project: Interactive App Tour
# Scope: Global

## Architecture
- `TourProvider.tsx` - Enhanced with robust `preActionClick` (which could be an array of actions, or delayed polling for buttons).
- `tour-steps.ts` - Updated definitions to automate clicks and fill inputs in modals for modules (Organizations, Users, License, AI).
- Target files: `src/components/tour/TourProvider.tsx`, `src/lib/tour-steps.ts`, and optionally adding data attributes in `src/features/...`

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Interactive Tour Implementation | Modify `TourProvider` & `tour-steps`, update feature files with selectors | none | PLANNED |

## Interface Contracts
- `TourProvider` will expose the same context interface `startTour`.
- `AppTourStep` will be extended if necessary (e.g., `preActionSelector` handling improvements).
