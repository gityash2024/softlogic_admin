# Handoff Report: App Tour System Fixes

## 1. Observation
- `src/features/license/LicensePage.tsx`: The submit button for "Bulk create activation keys" in the `Auto` mode (lines 2872-2886) and `Manual` mode (lines 2851-2865) lacks the `data-tour="tour-license-bulk-submit"` attribute. The button is defined as `<Button type="button" variant="primary" disabled={...} onClick={submitAutoBulk}>`.
- `src/features/ai/AiPage.tsx`: The allocate submit button for credits (line 790) is defined as `<Button type="submit" variant="outline" disabled={allocationMutation.isPending}>`. It lacks the `data-tour="tour-ai-allocate-submit"` attribute.
- `src/lib/tour-steps.ts`: Line 160 defines the selector for `user-role` as `target: 'select[name="role"]'`.

## 2. Logic Chain
1. The App Tour system relies on `data-tour` attributes to anchor steps in the UI and specific DOM selectors in the configuration file (`tour-steps.ts`).
2. In `LicensePage.tsx`, the tour configuration specifically guides users through the `Auto Generation` flow (`tour-license-bulk-auto` -> `tour-license-bulk-qty` -> `tour-license-bulk-submit`). Thus, we must inject the `data-tour="tour-license-bulk-submit"` attribute into the `submitAutoBulk` button (and optionally the manual `submitBulk` button for consistency).
3. In `AiPage.tsx`, the `Allocate credits` button is responsible for submitting the credit distribution form. Appending the `data-tour="tour-ai-allocate-submit"` attribute to this specific `<Button>` satisfies the final step requirement for the AI tour.
4. In `tour-steps.ts`, the tour attempts to target `select[name="role"]` for the user role step. The prompt explicitly specifies updating this selector to `#tour-user-role`.

## 3. Caveats
- No caveats. The exact required changes align perfectly with the reported errors from the review gate.

## 4. Conclusion
The issue can be resolved with three specific file modifications:

1. **`src/features/license/LicensePage.tsx`**: Update the `submitAutoBulk` button (and the `submitBulk` button).
   ```tsx
   <Button
     data-tour="tour-license-bulk-submit"
     type="button"
     variant="primary"
     disabled={
       !selectedOrganization ||
       autoBulkCount < 1 ||
       autoBulkCount > maxAutoBulkCount ||
       bulkMutation.isPending
     }
     onClick={submitAutoBulk}
   >
   ```

2. **`src/features/ai/AiPage.tsx`**: Update the allocation submit button (around line 790).
   ```tsx
   <Button data-tour="tour-ai-allocate-submit" type="submit" variant="outline" disabled={allocationMutation.isPending}>
     {allocationMutation.isPending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
     Allocate credits
   </Button>
   ```

3. **`src/lib/tour-steps.ts`**: Update the target string at line 160.
   ```typescript
   // Before
   target: 'select[name="role"]',

   // After
   target: '#tour-user-role',
   ```

## 5. Verification Method
1. Inspect the source code to confirm the edits match the described changes.
2. Run the React typescript check (`npx tsc --noEmit`) to verify no syntax errors were introduced.
3. Validate that the application builds successfully (`npm run build` from `admin_panel_softlogic`).
