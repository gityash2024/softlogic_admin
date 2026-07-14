# Investigation Handoff: Interactive Tour Implementation

## Observation

- **TourProvider.tsx (Lines 115-132)**: The tour engine executes `preActionSelector` and `preActionEvent` exactly once when the current step changes, *before* the polling interval starts. If a button (like "Generate Keys" `[data-tour="tour-license-bulk-create"]`) takes time to render (e.g., waiting for API data), `document.querySelector` returns `null`. The button is never clicked, the modal never opens, and the polling interval eventually times out (falling back to a centered tooltip).
- **tour-steps.ts (Lines 107-174)**: The steps for the Organizations and Users modules rely on implicit selectors such as `button:has(svg.lucide-plus)`, `input[name="name"]`, and `button[type="submit"]`. These are fragile and may select the wrong element or break if icons/forms change. 
- **LicensePage.tsx**: The page correctly listens for `tour-action-select-org` to programmatically select an organization. However, since `TourProvider` dispatches this event immediately on step change, it might race with component initialization.

## Logic Chain

1. **Robust Polling in TourProvider**: By moving the `preActionSelector` click and `preActionEvent` dispatch *inside* the `findElement()` polling interval, the engine will continuously search for the pre-action trigger. Once found, it clicks it, sets a `preActionFired` flag, and continues polling for the primary `target` (the modal content).
2. **Extended Timeout**: API requests and modal animations can take over 2 seconds combined. Increasing the polling attempts from 20 (2 seconds) to 50 (5 seconds) prevents the tour from abandoning the step prematurely.
3. **Explicit Selectors**: Replacing fragile selectors in `tour-steps.ts` with explicit `data-tour` attributes ensures the tour anchors strictly to the intended elements, maintaining resilience against UI structural changes.

## Caveats

- We assume that `preActionSelector` only needs to be clicked once per step.
- The forms for Organizations and Users (e.g., `OrganizationForm` or `UsersForm`) need `data-tour` attributes added to match the updated `tour-steps.ts` definitions.

## Conclusion

The `preAction` mechanism fails because it fires synchronously before elements mount. `TourProvider.tsx` must be updated to poll for the `preActionSelector` dynamically. Additionally, we must apply explicit `data-tour` tags to action elements across the app and update `tour-steps.ts`.

### Recommended Changes for `TourProvider.tsx`

Replace the `useEffect` polling block (around line 97) with this structure:

```tsx
    // 1. If step requires a different route, navigate first
    if (currentStep.route && location.pathname !== currentStep.route) {
      setTargetRect(null);
      navigate(currentStep.route);
      return;
    }

    // 2. Poll for the target element and handle pre-actions dynamically
    let attempts = 0;
    let preActionFired = false;
    let eventDispatched = false;

    const findElement = () => {
      // Check if target is already visible
      const el = document.querySelector(currentStep.target);
      if (el) {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const rect = el.getBoundingClientRect();
        setTargetRect({
          top: rect.top, left: rect.left, width: rect.width,
          height: rect.height, bottom: rect.bottom, right: rect.right,
        });
        return true;
      }

      // If target is NOT found, try dispatching pre-action event
      if (currentStep.preActionEvent && !eventDispatched) {
        window.dispatchEvent(new CustomEvent(currentStep.preActionEvent));
        eventDispatched = true;
      }

      // If target is NOT found, try clicking pre-action selector
      if (currentStep.preActionSelector && !preActionFired) {
        const actionBtn = document.querySelector(currentStep.preActionSelector) as HTMLElement;
        if (actionBtn) {
          actionBtn.click();
          preActionFired = true;
        }
      }

      attempts += 1;
      // After 50 attempts (5 seconds), stop polling
      if (attempts >= 50) {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        setTargetRect(null);
      }
      return false;
    };
```

### Recommended Selectors for `tour-steps.ts`

**Organizations (`tour-steps.ts`)**:
- `org-create-btn`: `[data-tour="tour-org-create-btn"]`
- `org-name`: `[data-tour="tour-org-name-input"]`
- `org-branding`: `[data-tour="tour-org-colors"]` (Keep, but ensure it exists in form)
- `org-submit`: `[data-tour="tour-org-submit"]`

**Users (`tour-steps.ts`)**:
- `user-create-btn`: `[data-tour="tour-user-create-btn"]`
- `user-email`: `[data-tour="tour-user-email-input"]`
- `user-role`: `[data-tour="tour-user-role-select"]`
- `user-submit`: `[data-tour="tour-user-submit"]`

*Action required*: Add these `data-tour` attributes to the respective buttons and inputs in `OrganizationsPage.tsx`, `UsersPage.tsx`, and their child form components.

## Verification Method

1. Run `npm run build` to verify TypeScript integrity.
2. Log into the application as `SUPER_ADMIN`.
3. Launch the "License" tour. Observe that the "Generate Keys" button is automatically clicked once the partner is loaded, and the modal fields are successfully highlighted.
4. Launch the "Organizations" tour and verify it successfully clicks the "Create organization" button using the new `data-tour` attribute.
