import ms, { StringValue } from "ms";

interface RetryOptions {
  maxRetries: number;
  onError?: (error: unknown) => void | Promise<void>;
  // Return false to stop retrying, return true to automatically delay the next retry, or a number to set the delay before the next retry
  isErrorRetryable?: (error: unknown) => boolean | number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  let delay = 1000;
  let lastError: unknown = null;
  for (let i = 0; i < options.maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (options.onError) {
        await options.onError(err);
      }
      if (options.isErrorRetryable) {
        const res = options.isErrorRetryable(err);
        if (res === false) {
          throw err;
        } else if (typeof res === "number") {
          delay = res;
        }
      }
      lastError = err;
    }
    await sleep(delay);
    delay *= 2;
  }
  throw lastError;
}

export function checkLlmRetryableState(error: unknown) {
  const maybe = error as { status?: unknown; headers?: unknown; message?: unknown };
  const status = typeof maybe?.status === "number" ? maybe.status : extractStatusFromMessage(error);

  if (!status) return false;

  if ([500, 502, 503, 504].includes(status)) return true;

  if (status === 429) {
    const headers =
      typeof maybe.headers === "object" && maybe.headers !== null
        ? (maybe.headers as Record<string, unknown>)
        : undefined;
    const retryAfterTokensHeader = headers?.["x-ratelimit-reset-tokens"];
    const retryAfterRequestsHeader = headers?.["x-ratelimit-reset-requests"];
    const retryAfterTokens = typeof retryAfterTokensHeader === "string" ? retryAfterTokensHeader : undefined;
    const retryAfterRequests = typeof retryAfterRequestsHeader === "string" ? retryAfterRequestsHeader : undefined;
    if (!retryAfterTokens || !retryAfterRequests) return true;

    const retryAfter = Math.max(ms(retryAfterTokens as StringValue), ms(retryAfterRequests as StringValue));
    return Number.isFinite(retryAfter) ? retryAfter : true;
  }

  return false;
}

function extractStatusFromMessage(error: unknown): number | null {
  let message: string | undefined;

  if (typeof error === "string") {
    message = error;
  } else if (typeof error === "object" && error !== null && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string") {
      message = maybeMessage;
    }
  }

  if (!message) return null;

  const patterns = [/LLM API error:\s*(\d{3})/i, /ai\.ubq\.fi error:\s*(\d{3})/i];
  for (const pattern of patterns) {
    const match = pattern.exec(message);
    const statusText = match?.[1];
    if (!statusText) continue;
    const status = Number.parseInt(statusText, 10);
    if (Number.isFinite(status)) return status;
  }
  return null;
}
