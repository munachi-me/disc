import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom has no media playback: stub the HTMLMediaElement methods DISC calls.
Object.defineProperty(window.HTMLMediaElement.prototype, 'play', { configurable: true, value: vi.fn(() => Promise.resolve()) });
Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() });
Object.defineProperty(window.HTMLMediaElement.prototype, 'load', { configurable: true, value: vi.fn() });
window.matchMedia ||= (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
window.scrollTo = vi.fn();
URL.createObjectURL ||= vi.fn(() => 'blob:test');
URL.revokeObjectURL ||= vi.fn();

afterEach(() => cleanup());
