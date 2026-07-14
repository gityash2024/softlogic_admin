# TourProvider Challenge Report

## Observation
I reviewed `TourProvider.tsx`, specifically the `useEffect` polling loop that handles `preActionSelectors` and `currentStep.target` discovery. I found multiple critical flaws in the polling logic, event dispatching, and state management that can lead to infinite loops, application crashes, and severe performance degradation.

1. **Route Enforcement (`location.pathname`):** The `useEffect` depends on `location.pathname`. If `location.pathname !== currentStep.route`, it forces a `navigate(currentStep.route)`.
2. **Polling Loop State Reset:** `actionIndex` and `attempts` are defined inside the `useEffect`. If the effect re-runs, they reset to `0`.
3. **Forced Pre-actions (`forcePreActions`):** If `preActionSelectors` is an array, `forcePreActions` is `true`. The loop clicks all selectors regardless of whether `targetEl` is already present: `if (forcePreActions || !targetEl) { ... }`.
4. **Event Order:** The fake click dispatches events in the order: `pointerdown`, `mousedown`, `click`, `pointerup`, `mouseup`.
5. **Context Value:** `<TourContext.Provider value={{ startTour }}>` provides a new object literal on every render.
6. **Scroll Listener:** `updatePosition` is attached to `window.addEventListener('scroll', ...)` and calls `setTargetRect({...})` with a newly constructed object literal on every scroll frame.
7. **Error Handling:** `document.querySelector()` calls are not wrapped in `try...catch` within the `setInterval` callback.

## Logic Chain

### 1. Infinite Route-Flicker Loop (CRITICAL)
If a `preActionSelector` clicks an element that causes navigation to a different route (e.g., a link or an unrelated tab), `location.pathname` changes. This triggers the `useEffect` to re-run, clearing the interval. Since the new path no longer matches `currentStep.route`, the effect immediately forces navigation back to `currentStep.route`. This changes the path again, re-running the effect, resetting `actionIndex` to `0`, and restarting the polling loop. The loop clicks the offending element again, causing an infinite loop of rapid route changes that will freeze the browser tab.

### 2. `forcePreActions` Blind Toggle Bug (HIGH)
When `preActionSelectors` is used, `forcePreActions` is `true`. This causes the loop to blindly click every selector in the array, even if the final `targetEl` is already visible. If the user already has a dropdown or modal open, the forced click on its trigger will *close* it, causing the `targetEl` to disappear and the tour step to fail (timing out after 20 attempts).

### 3. Context Value Thrashing on Scroll (HIGH)
During a smooth scroll (or user scroll), the `scroll` event fires dozens of times per second. Each time, `updatePosition` calls `setTargetRect` with a new object, forcing `TourProvider` to re-render. Because the context value is an inline object (`{{ startTour }}`), its reference changes on every render. This forces *every component in the application that consumes `useTour()`* to re-render on every single scroll frame, leading to severe scroll jank.

### 4. Unhandled Selector Exceptions in Interval (MEDIUM)
If a step contains an invalid CSS selector in `target` or `preActionSelectors` (e.g., leading numbers like `123-btn`), `document.querySelector` will throw a synchronous `SyntaxError`. Because the interval callback has no `try...catch`, the error halts that specific tick, but the browser's `setInterval` continues to fire every 100ms. This results in an endless flood of uncaught exceptions in the console.

### 5. Incorrect Event Dispatch Order (MEDIUM)
The polling loop dispatches `click` *before* `pointerup` and `mouseup`. The native `.click()` method may synchronously trigger React state changes that unmount the clicked element. If the element is unmounted, the subsequent `pointerup` and `mouseup` events are dispatched on a detached DOM node. They will not bubble up to `window` or `document`, causing global listeners (like click-away detectors or drag-and-drop managers) to miss the `mouseup` event and remain in a stuck state.

## Caveats
- The infinite route-flicker loop requires a `preActionSelector` that actually triggers navigation away from the enforced `currentStep.route`. If all pre-actions stay on the same route, this specific infinite loop will not trigger.
- The context value thrashing only affects performance if the application has components that consume `useTour()` and are expensive to render.

## Conclusion
The `TourProvider`'s polling loop is highly vulnerable to infinite loops, state toggling issues, and severe performance degradation. The implementation needs structural fixes:
- Prevent infinite routing loops by verifying if a pre-action click caused an unintended route change and aborting.
- Add visibility checks before forcefully clicking elements if the target is already visible.
- Memoize the `TourContext.Provider` value using `useMemo`.
- Fix the event dispatch order: `pointerdown` -> `mousedown` -> `pointerup` -> `mouseup` -> `click`.
- Wrap `document.querySelector` calls in `try...catch` blocks to gracefully fail and clear the interval on invalid selectors.

## Verification Method
- **Context Thrashing**: Add a `console.log("Tour consumer rendered")` inside any component calling `useTour()`, start the tour, and scroll the page. Observe the flood of logs.
- **Event Order**: Set a breakpoint on the `click()` call in `TourProvider.tsx:124`, or create a pre-action that closes a modal and verify `mouseup` never reaches `window`.
- **Invalid Selector**: Edit `src/lib/tour-steps.ts` to include an invalid selector like `123-invalid`, start the tour, and observe the endless stream of exceptions in the browser console.
