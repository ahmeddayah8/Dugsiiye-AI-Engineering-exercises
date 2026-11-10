const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry(fn, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const status = error.status;

      const retryable =
        status === 408 ||
        status === 409 ||
        status === 429 ||
        status >= 500 ||
        status === undefined;

      if (!retryable || attempt === attempts) {
        throw error;
      }

      const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);

      console.warn(`Attempt ${attempt} failed. Retrying...`);

      await sleep(delay);
    }
  }
}
