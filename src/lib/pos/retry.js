const TRANSIENT_ERROR_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
]);

export function isRetryableError(error) {
  if (!error) return false;

  const code = String(error.code || error.status || '').toUpperCase();
  const message = String(error.message || error || '').toLowerCase();

  if (TRANSIENT_ERROR_CODES.has(code)) return true;
  if (message.includes('timeout')) return true;
  if (message.includes('temporarily unavailable')) return true;
  if (message.includes('fetch failed')) return true;
  if (message.includes('network')) return true;
  if (message.includes('service unavailable')) return true;

  const status = Number(error.status || error.statusCode);
  return Number.isFinite(status) && status >= 500 && status < 600;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry(operation, options = {}) {
  const attempts = Math.max(1, Math.floor(options.attempts || 3));
  const baseDelayMs = Math.max(0, Math.floor(options.baseDelayMs || 25));
  const factor = Number.isFinite(options.factor) && options.factor > 1 ? options.factor : 2;
  const shouldRetry =
    typeof options.shouldRetry === 'function' ? options.shouldRetry : isRetryableError;
  const onRetry = typeof options.onRetry === 'function' ? options.onRetry : null;

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetry(error, attempt)) {
        throw error;
      }
      if (onRetry) onRetry(error, attempt);
      const delay = Math.round(baseDelayMs * factor ** (attempt - 1));
      if (delay > 0) await sleep(delay);
    }
  }

  throw lastError;
}
