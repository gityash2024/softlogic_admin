# Handoff Report

## Observation
- `TourProvider.tsx` currently manages a 9-step tour. It works by monitoring `currentStep.route`, navigating to it if necessary using `useNavigate`, and polling `document.querySelector(currentStep.target)` up to 20 times (2 seconds) to find and highlight the target element.
- The `AppTourStep` type in `src/lib/tour-steps.ts` holds `id`, `target`, `title`, `content`, `route`, and `placement`.
- Core workflow components are located at:
  - Organizations: `src/features/organizations/OrganizationsPage.tsx`, `OrganizationFormPage.tsx`
  - Users: `src/features/users/UsersPage.tsx`, `UserFormPage.tsx`
  - Licensing: `src/features/license/LicensePage.tsx`
  - AI Module: `src/features/ai/AiPage.tsx`

## Logic Chain
- To expand the tour to 25+ steps sequentially covering the requested flows, we must add specific CSS ID targets to all intermediate form fields and buttons across the above page components.
- Because the tour moves through multiple steps within the same page (e.g. 7 steps on `/organizations/new`), React Router's `navigate` alone isn't enough for elements that might require a user interaction or are rendered conditionally (like dropdowns).
- `TourProvider` can handle cross-route navigation smoothly because React Router's state updates trigger a re-render, and the polling mechanism in `useEffect` automatically finds the target element once the DOM updates. 
- To target deeply nested elements or elements that require a preceding action (like opening a Radix UI `<Select>`), we can modify the `AppTourStep` interface to include an optional `preActionSelector`. The polling loop in `TourProvider.tsx` can invoke `.click()` on the `preActionSelector` if the main `target` is not yet visible in the DOM.

## Caveats
- Relying on native `.click()` for React components (especially third-party like Radix UI) can sometimes fail if synthetic events are strictly expected. In such cases, the tour content must prompt the user to manually click/open the element.
- We must ensure that the "Next" button on the Tour card has `type="button"` (which it does) so it doesn't accidentally submit forms when clicking through the steps.
- Adding 25+ steps forces a long sequence. Users must be able to skip the tour at any time (the current component allows skipping).

## Conclusion
We have mapped the existing architecture and the necessary component paths. `TourProvider.tsx` can be enhanced with `preActionSelector` logic, and IDs can be injected across the core forms to support a 26-step continuous sequence. 

### Proposed TourProvider Modification:
Add `preActionSelector?: string;` to `AppTourStep`.
In `TourProvider.tsx` polling loop:
```typescript
    const findElement = () => {
      // If a pre-action is defined and the target isn't found yet, try clicking it
      if (currentStep.preActionSelector && !document.querySelector(currentStep.target)) {
        const preEl = document.querySelector(currentStep.preActionSelector) as HTMLElement;
        if (preEl) preEl.click();
      }
      
      const el = document.querySelector(currentStep.target);
      // ... existing scroll and setTargetRect logic ...
    };
```

### Proposed 26-Step Tour Plan:
1. `dashboard-welcome` (`/dashboard`, `[data-tour="tour-dashboard-stats"]`): Welcome & real-time snapshot.
2. `dashboard-metrics` (`/dashboard`, `[data-tour="tour-dashboard-metrics"]`): Key numbers.
3. `org-list` (`/organizations`, `[data-tour="tour-organizations-list"]`): Manage organizations list.
4. `org-create-btn` (`/organizations`, `#tour-org-create-btn`): Click to create new org.
5. `org-form-name` (`/organizations/new`, `#tour-org-name`): Organization name input.
6. `org-form-kind` (`/organizations/new`, `#tour-org-kind`): Customer/Partner selector.
7. `org-form-branding` (`/organizations/new`, `#tour-org-branding-mode`): Branding mode (White Label vs SoftLogic).
8. `org-form-colors` (`/organizations/new`, `#tour-org-colors`): Brand colors and logo upload.
9. `org-form-limits-teacher` (`/organizations/new`, `#tour-org-teacher-limit`): Teacher seat limit.
10. `org-form-limits-student` (`/organizations/new`, `#tour-org-student-limit`): Student seat limit.
11. `org-form-submit` (`/organizations/new`, `#tour-org-submit`): Submit organization button.
12. `users-list` (`/users`, `[data-tour="tour-users-list"]`): User management list.
13. `users-create-btn` (`/users`, `#tour-user-create-btn`): Click to add a user.
14. `user-form-name` (`/users/new`, `#tour-user-name`): User basic details.
15. `user-form-email` (`/users/new`, `#tour-user-email`): Mail invite system notification.
16. `user-form-role` (`/users/new`, `#tour-user-role`): Assign role permissions.
17. `user-form-org` (`/users/new`, `#tour-user-org`): Link user to organization.
18. `user-form-submit` (`/users/new`, `#tour-user-submit`): Submit user to dispatch invite.
19. `license-stats` (`/license`, `[data-tour="tour-license-stats"]`): Licensing overview.
20. `license-generate` (`/license`, `#tour-license-generate-btn`): Generate hardware keys.
21. `license-allocation` (`/license`, `#tour-license-allocation`): Allocate keys.
22. `ai-credits` (`/ai`, `[data-tour="tour-ai-credits"]`): AI master config & pool.
23. `ai-topup` (`/ai`, `#tour-ai-topup`): Add master credits.
24. `ai-allocation` (`/ai`, `#tour-ai-allocation-type`): Allocate AI credits to child accounts.
25. `activity-audit` (`/activity`, `[data-tour="tour-activity-list"]`): Admin activity trail.
26. `settings-hub` (`/settings`, `[data-tour="tour-settings"]`): Settings, profile, and replay tour.

### Target Files to Add IDs:
- `src/features/organizations/OrganizationsPage.tsx`
- `src/features/organizations/OrganizationFormPage.tsx`
- `src/features/users/UsersPage.tsx`
- `src/features/users/UserFormPage.tsx`
- `src/features/license/LicensePage.tsx`
- `src/features/ai/AiPage.tsx`
- `src/lib/tour-steps.ts`
- `src/components/tour/TourProvider.tsx`

## Verification Method
- Execute the build command `npm run build` after modifying the files to ensure the TypeScript interfaces resolve correctly.
- Verify that `TourProvider.tsx` properly invokes the tour overlay when navigating to new nested routes.
- Validate the DOM targeting by using a local development server (`npm run dev`) and checking if each element gets successfully highlighted when proceeding through the tour.
