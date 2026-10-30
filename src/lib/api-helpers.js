import { NextResponse } from 'next/server';
import { ProviderError } from '@/lib/utilities/http';
import { PROVIDER_IDS } from '@/lib/music-providers';

export function json(data, { status = 200, maxAge = 60 } = {}) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': status === 200 ? `private, max-age=${maxAge}` : 'no-store' } });
}

export function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function parseProviders(value) {
  if (!value) return undefined;
  const ids = String(value).split(',').map((s) => s.trim()).filter((s) => PROVIDER_IDS.includes(s));
  return ids.length ? ids : undefined;
}

export function parseQuality(value) {
  return value === 'standard' ? 'standard' : 'high';
}

export function errorResponse(err) {
  if (err instanceof ProviderError) {
    const status = err.status === 404 ? 404 : err.code === 'credentials' ? 503 : err.code === 'timeout' ? 504 : err.code === 'invalid' && err.status ? err.status : 502;
    return json({ error: { code: err.code, message: err.message, provider: err.provider } }, { status });
  }
  return json({ error: { code: 'internal', message: 'Something went wrong on the server.' } }, { status: 500 });
}

export function badRequest(message) {
  return json({ error: { code: 'bad_request', message } }, { status: 400 });
}
