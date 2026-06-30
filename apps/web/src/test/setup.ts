import '@testing-library/jest-dom/vitest';

// jsdom lacks ResizeObserver, which HrChart relies on.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver =
  globalThis.ResizeObserver ??
  (ResizeObserverStub as unknown as typeof ResizeObserver);
