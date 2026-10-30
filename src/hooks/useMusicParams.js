'use client';
import { useSettings } from '@/lib/storage/settingsStore';

/** Re-run data loaders when provider, quality or explicit-content settings change. */
export function useMusicParamsKey() {
  const providers = useSettings((s) => s.providers);
  const quality = useSettings((s) => s.quality);
  const explicit = useSettings((s) => s.explicit);
  return `${Object.entries(providers).filter(([, v]) => v).map(([k]) => k).join(',')}|${quality}|${explicit}`;
}
