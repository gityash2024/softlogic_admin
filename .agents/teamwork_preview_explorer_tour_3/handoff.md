# Observation
1. **`AppTourStep` Interface (`src/lib/tour-steps.ts`)**: Currently defines `preActionSelector?: string;` which is executed once immediately when a step is loaded, but does not robustly wait for the element to appear or support sequential clicks (e.g., clicking a dropdown trigger, waiting for the portal to render, then clicking an option).
2. **Polling Mechanism (`src/components/tour/TourProvider.tsx`)**: In the implementation of Milestone 1, the `TourProvider` tries to click `preActionSelector` only once on initialization. If the element is hidden inside a Radix UI dropdown or a modal that hasn't finished animating, it fails.
3. **Hierarchy Demonstration**: The License and AI tours need to automatically open dropdowns and click a specific organization/partner to show a "complete flow". For example, `[data-tour="tour-license-org-select"]` is available for `SUPER_ADMIN` and `PARTNER_ADMIN` to select an organization.

# Logic Chain
1. To support deep interactivity (R2 & R3), the tour engine needs a robust sequential action processor. 
2. Adding `preActionSelectors?: string[];` and `preActionForce?: boolean;` to `AppTourStep` will allow defining a sequence of selectors (e.g., `['[data-tour="tour-license-org-select"]', '[role="option"]:nth-of-type(2)']`).
3. Within `TourProvider.tsx`, the `setInterval` polling loop (or `findElement` function) should iterate over `preActionSelectors` sequentially. It should poll for the first selector, wait until it appears, click it (using pointer events to satisfy Radix UI), then move to the next selector on the subsequent interval.
4. Once all `preActionSelectors` are clicked, it should poll for the main `target` element and highlight it.
5. If the `target` element is *already* visible when the step starts (e.g. if the modal is already open), the `preActionSelectors` should be skipped by default to avoid closing the modal by clicking its trigger again. However, for dropdowns where we *want* to force a selection even if the dropdown trigger is visible, `preActionForce: true` ensures the actions are executed.

# Caveats
- Radix UI `Select` items (`[role="option"]`) do not always respond to a simple `.click()` because they listen to `pointerdown`/`pointerup`. The implementation must dispatch these events alongside `click()`.
- Super Admin licensing view initializes with "General licensing overview" (`GLOBAL_LICENSE_VALUE`). The partner `SelectTrigger` in `LicensePage.tsx` requires `data-tour="tour-license-org-select"` to be selectable by the tour engine.

# Conclusion
The `TourProvider` polling mechanism should be redesigned to process an array of `preActionSelectors` sequentially within its polling loop, using pointer events for Radix UI compatibility. The `tour-steps.ts` definitions must be updated to use these sequential arrays to navigate modals and dropdowns automatically.

# Verification Method
1. Build the application via `npm run build` to verify no TypeScript errors are introduced.
2. Log in as `SUPER_ADMIN` and trigger the Licensing tour via the floating button.
3. Observe that the tour automatically clicks the partner dropdown, selects a partner, clicks "Generate Hardware Keys", and successfully clicks the "Auto" tab inside the modal before highlighting the quantity field.
4. Review the source of `src/components/tour/TourProvider.tsx` and `src/lib/tour-steps.ts` to ensure `react-joyride` is not used.

## Proposed Code Changes

### 1. `src/lib/tour-steps.ts`
Update `AppTourStep` interface:
```typescript
export interface AppTourStep {
  id: string;
  target: string;
  title: string;
  content: string;
  route: string;
  placement?: 'top' | 'bottom';
  preActionSelector?: string;
  preActionSelectors?: string[]; // Array of selectors to click sequentially
  preActionForce?: boolean; // If true, force execution even if target is already in DOM
  preActionEvent?: string;
}
```

Update steps in `getTourStepsForProfile`:
- **License**:
```typescript
      steps.push({
        id: 'license-org-select',
        target: '[data-tour="tour-license-org-select"]',
        title: 'Select an Organisation',
        content: 'Select a specific partner or organisation here to manage their individual activation keys and allocations.',
        route: '/license',
        placement: 'bottom',
        preActionSelectors: ['[data-tour="tour-license-org-select"]', '[role="option"]:nth-of-type(2)'],
        preActionForce: true
      });
...
    steps.push({
      id: 'license-generate-type',
      target: '[data-tour="tour-license-bulk-auto"]',
      title: 'Auto Generation',
      content: 'Select the automatic mode to let the system instantly generate random, secure keys.',
      route: '/license',
      placement: 'bottom',
      preActionSelectors: ['[data-tour="tour-license-bulk-create"], [data-tour="tour-license-bulk-create-secondary"]']
    });
...
    steps.push({
      id: 'license-generate-qty',
      target: '[data-tour="tour-license-bulk-qty"]',
      title: 'Quantity',
      content: 'Specify exactly how many activation keys you need to provision for your hardware shipment.',
      route: '/license',
      placement: 'bottom',
      preActionSelectors: ['[data-tour="tour-license-bulk-create"], [data-tour="tour-license-bulk-create-secondary"]', '[data-tour="tour-license-bulk-auto"]']
    });
```
- **AI**:
```typescript
    steps.push({
      id: 'ai-allocate-target',
      target: '[data-tour="tour-ai-allocate-target"]',
      title: 'Select Target',
      content: 'Choose whether you are allocating credits to an entire Organisation or a specific User.',
      route: '/ai',
      placement: 'bottom',
      preActionSelectors: ['[data-tour="tour-ai-allocate-target"]', '[role="option"]:nth-of-type(2)'],
      preActionForce: true
    });
```

### 2. `src/components/tour/TourProvider.tsx`
Replace the `preActionSelector` evaluation inside the `useEffect` with a robust sequential handler:

```typescript
    // Inside useEffect for locating elements:
    
    // Optional: trigger a custom event once on step start
    if (currentStep.preActionEvent) {
      window.dispatchEvent(new CustomEvent(currentStep.preActionEvent));
    }

    const forcePreActions = !!currentStep.preActionForce;
    const selectorsToClick = currentStep.preActionSelectors 
      ? [...currentStep.preActionSelectors] 
      : (currentStep.preActionSelector ? [currentStep.preActionSelector] : []);

    let actionIndex = 0;
    let attempts = 0;

    const findElement = () => {
      // Execute sequential clicks first
      if (actionIndex < selectorsToClick.length) {
        const targetEl = document.querySelector(currentStep.target);
        if (forcePreActions || !targetEl) {
          const selector = selectorsToClick[actionIndex];
          const actionBtn = document.querySelector(selector) as HTMLElement;
          if (actionBtn) {
            // Radix select items sometimes need pointerdown/up events alongside click
            actionBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            actionBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            actionBtn.click();
            actionBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
            actionBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            
            actionIndex++;
            attempts = 0; // reset attempts for the next action/target
          } else {
            attempts++;
            if (attempts >= 20) { // skip if not found after 2 seconds
              actionIndex++;
              attempts = 0;
            }
          }
          return false;
        } else {
          // targetEl found and forcePreActions is false, skip remaining fallback actions
          actionIndex = selectorsToClick.length;
        }
      }

      // After all pre-actions, look for the actual target
      const el = document.querySelector(currentStep.target);
      if (el) {
        // ... highlight and scroll ...
        return true;
      }
      
      attempts += 1;
      if (attempts >= 20) {
        // timeout
      }
      return false;
    };
```

### 3. `src/features/license/LicensePage.tsx`
Add the `data-tour` attribute to the Super Admin's partner selection trigger:
```typescript
              <Select
                value={selectedPartnerId}
                onValueChange={handleSuperAdminPartnerChange}
              >
                <SelectTrigger data-tour="tour-license-org-select">
                  <SelectValue />
                </SelectTrigger>
```
