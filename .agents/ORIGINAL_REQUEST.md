# Original User Request

## Initial Request — 2026-07-13T10:54:02Z

Implement a dual-layer custom App Tour system: a simple, high-level initial onboarding tour that runs on first login, plus highly detailed, on-demand, module-specific tours (for Organizations, Users, License, and AI) triggered by a persistent floating button.

Working directory: `C:/Users/YashJangid/Desktop/yash/admin_panel_softlogic`
Integrity mode: development

## Requirements

### R1. Simplified Initial Tour
Revert the current massive 21-step tour back to a simple, high-level initial onboarding sequence (similar to the original 9-step overview). It should hit the top-level pages and metrics. However, at the very end of this initial tour, include a step or message that suggests taking the detailed module tours to learn more.

### R2. Contextual Detailed Module Tours
Create deeply functional tours tailored to specific modules (Organizations, Users, Licensing, AI). When triggered, a module tour should walk the user through that specific workflow in detail (e.g., highlighting form inputs for creating an organization, generating keys, or assigning AI credits) without them having to type.

### R3. Persistent Floating Tour Trigger
Add a persistent floating "Help/Tour" button to the bottom corner of the screen. When clicked, it should present the user with options to launch the detailed tour relevant to the module they are currently viewing, or replay the high-level tour. 

### R4. No External Tour Libraries
You must use and extend the existing custom React `TourProvider.tsx` and overlay logic. Do NOT install or use external libraries like `react-joyride`. The tour must maintain the current exact Flutter UI aesthetic (double-stroke spotlight and dark navy cutout scrim).

## Acceptance Criteria

### Functional Architecture
- [ ] The `TourProvider` or a contextual hook supports starting different "tour profiles" (e.g., `startTour('initial')`, `startTour('organizations')`, etc.).
- [ ] A persistent floating button exists in the bottom corner of the layout, opening a menu or immediately launching the contextual tour based on the current route.
- [ ] The initial auto-tour does not drag the user through all the detailed forms; it stays high-level and ends with a suggestion to use the floating button.
- [ ] The module tours correctly navigate and highlight deep functional form elements across the app.

### Implementation Integrity
- [ ] `package.json` contains no new dependencies for tour/onboarding libraries.
- [ ] The application builds successfully via `npm run build` without TypeScript errors.

## Follow-up — 2026-07-14T10:28:55+05:30

Build a fully interactive, deep-dive App Tour for the Licensing (and other) modules. The tour must not just be 1-2 steps; it must programmatically interact with the UI (e.g., selecting an organization, opening the "Generate Keys" modal, and highlighting specific fields inside modals) to demonstrate the complete, real-world workflow step-by-step.

Working directory: `C:/Users/YashJangid/Desktop/yash/admin_panel_softlogic`
Integrity mode: development

## Requirements

### R1. Deeply Interactive Functional Tours
The detailed module tours (Organizations, Users, License, AI) must cover every functional aspect, "small to small", rather than just a 1-2 step general overview. This means opening modals, filling/selecting fields, and showing real interaction.

### R2. Auto-Selection and Hierarchy Demonstration
When demonstrating hierarchy-specific functionality (like allocating keys to a specific partner), the tour must automatically find and click an available organization/partner in the dropdown/list so the user sees a complete flow without needing to manually select anything. 

### R3. Automated Modal Handling
Enhance the existing custom tour engine (`TourProvider.tsx` and `tour-steps.ts`) to robustly support a `preActionClick` (or `actionSelector`) mechanism. The engine must automatically click buttons (e.g., "Generate Keys") to open modals before highlighting the form fields inside them, ensuring the tour doesn't break or point to the center of the screen when targeting hidden elements.

### R4. Pure React Custom Implementation
You must continue using the existing custom React `TourProvider.tsx` architecture. Do NOT use `react-joyride` or other external libraries.

## Acceptance Criteria

### Interaction Integrity
- [ ] The engine correctly executes `preActionClick` to open modals or dropdowns before attempting to locate the `target` element.
- [ ] In the Licensing tour, the engine successfully clicks a partner/organization from the list, clicks to open the "Generate Keys" and "Allocate Keys" modals, and highlights specific inputs inside them sequentially.
- [ ] The tour does not get stuck pointing at the center of the screen; it correctly waits for the modal to animate and the target element to mount.
- [ ] The application builds successfully via `npm run build` without TypeScript errors.
