import { create } from 'zustand';

let n = 0;
export const useToasts = create((set, get) => ({
  toasts: [],
  push(message, { tone = 'info', ms = 4000 } = {}) {
    const id = ++n;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, message, tone }] }));
    if (ms) setTimeout(() => get().dismiss(id), ms);
    return id;
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

export const toast = (message, opts) => useToasts.getState().push(message, opts);
