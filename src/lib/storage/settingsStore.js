import { create } from 'zustand';

export const DEFAULT_SETTINGS = {
  volume: 0.8,
  autoplayNext: true,
  shuffle: false,
  explicit: 'allow', // 'allow' | 'hide'
  quality: 'high', // 'high' | 'standard' (only Jamendo exposes this)
  accent: 'violet',
  providers: { itunes: true, jamendo: true, archive: true },
  providerOrder: ['jamendo', 'archive', 'itunes'],
};

export const ACCENTS = {
  violet: { label: 'Violet', rgb: '139 92 246', bright: '167 139 250' },
  orchid: { label: 'Orchid', rgb: '168 85 247', bright: '216 180 254' },
  indigo: { label: 'Indigo', rgb: '99 102 241', bright: '165 180 252' },
};

const KEY = 'disc-settings';

function load() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function sanitize(s) {
  const d = DEFAULT_SETTINGS;
  const x = s && typeof s === 'object' ? s : {};
  const order = Array.isArray(x.providerOrder) ? x.providerOrder.filter((p) => d.providerOrder.includes(p)) : [];
  return {
    volume: Number.isFinite(x.volume) ? Math.min(1, Math.max(0, x.volume)) : d.volume,
    autoplayNext: typeof x.autoplayNext === 'boolean' ? x.autoplayNext : d.autoplayNext,
    shuffle: typeof x.shuffle === 'boolean' ? x.shuffle : d.shuffle,
    explicit: x.explicit === 'hide' ? 'hide' : 'allow',
    quality: x.quality === 'standard' ? 'standard' : 'high',
    accent: ACCENTS[x.accent] ? x.accent : d.accent,
    providers: { ...d.providers, ...Object.fromEntries(Object.entries(x.providers || {}).filter(([k, v]) => k in d.providers && typeof v === 'boolean')) },
    providerOrder: [...order, ...d.providerOrder.filter((p) => !order.includes(p))],
  };
}

export const useSettings = create((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,
  load() {
    set({ ...load(), loaded: true });
  },
  update(patch) {
    set(patch);
    try {
      const { volume, autoplayNext, shuffle, explicit, quality, accent, providers, providerOrder } = get();
      localStorage.setItem(KEY, JSON.stringify({ volume, autoplayNext, shuffle, explicit, quality, accent, providers, providerOrder }));
    } catch {
      /* storage may be disabled; settings stay in memory */
    }
  },
  reset() {
    get().update({ ...DEFAULT_SETTINGS });
  },
}));

/** Providers the user has switched on, in their preferred order. */
export function enabledProviderIds(s = useSettings.getState()) {
  return s.providerOrder.filter((id) => s.providers[id]);
}
