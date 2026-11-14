import '@testing-library/jest-dom/vitest';
import '@/i18n';

// jsdom gaps used by cmdk / Radix
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
