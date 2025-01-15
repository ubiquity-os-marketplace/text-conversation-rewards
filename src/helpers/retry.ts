interface RetryOptions {
  maxRetries: number;
  onError?: (error: unknown) => void | Promise<void>;
  isErrorRetryable?: (error: unknown) => boolean;
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
      if (options.isErrorRetryable && !options.isErrorRetryable(err)) {
        throw err;
      }
      lastError = err;
    }
    await sleep(delay);
    delay *= 2;
  }
  throw lastError;
}
