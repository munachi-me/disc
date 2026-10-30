/**
 * @typedef {'timeout'|'network'|'http'|'invalid'|'credentials'|'aborted'} ProviderErrorCode
 */
export class ProviderError extends Error {
  /** @param {ProviderErrorCode} code @param {string} message @param {{provider?: string, status?: number}} [extra] */
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.provider = extra.provider;
    this.status = extra.status;
  }
}

/**
 * Fetch JSON with a timeout and optional caller abort signal.
 * Throws ProviderError with a stable `code` so callers can show a useful message.
 */
export async function fetchJson(url, { signal, timeoutMs = 8000, fetchImpl, provider, headers } = {}) {
  const doFetch = fetchImpl || globalThis.fetch;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    const res = await doFetch(url, { signal: controller.signal, headers: { Accept: 'application/json', ...headers } });
    if (!res.ok) throw new ProviderError('http', `Request failed with status ${res.status}`, { provider, status: res.status });
    try {
      return await res.json();
    } catch {
      throw new ProviderError('invalid', 'The provider returned a response that was not valid JSON.', { provider });
    }
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if (timedOut) throw new ProviderError('timeout', `The provider did not respond within ${Math.round(timeoutMs / 1000)}s.`, { provider });
    if (err?.name === 'AbortError') throw new ProviderError('aborted', 'The request was cancelled.', { provider });
    throw new ProviderError('network', 'Could not reach the provider. Check your connection and try again.', { provider });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onAbort);
  }
}
