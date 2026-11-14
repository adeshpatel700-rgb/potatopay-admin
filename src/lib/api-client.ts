const DEVELOPMENT_API_URL = "http://localhost:4000";
export const API_REQUEST_TIMEOUT_MS = 15_000;

export class ApiRequestTimeoutError extends Error {
  constructor(message = "The request took too long. Please try again.") {
    super(message);
    this.name = "ApiRequestTimeoutError";
  }
}

export class ApiRequestError extends Error {
  constructor(message: string, public readonly status: number) { super(message); this.name = "ApiRequestError"; }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = API_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const callerSignal = init.signal;
  const abortFromCaller = () => controller.abort();

  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener("abort", abortFromCaller, { once: true });
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new ApiRequestTimeoutError();
    throw error;
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

export function getApiUrl(path: `/${string}`): string {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || (process.env.NODE_ENV === "production" ? "" : DEVELOPMENT_API_URL);
  if (!base) throw new Error("NEXT_PUBLIC_API_URL must be configured for the production admin app.");
  return `${base}${path}`;
}

export async function apiRequest<T>(path: `/${string}`, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (typeof init.body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetchWithTimeout(getApiUrl(path), { ...init, headers, credentials: "include" });
  } catch (error) {
    if (error instanceof ApiRequestTimeoutError) throw new ApiRequestError(error.message, 408);
    throw new ApiRequestError("Could not reach the Potatopay API.", 0);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : fallbackErrorMessage(response.status);
    throw new ApiRequestError(message, response.status);
  }
  return payload as T;
}

/** Used when the response had no message of its own, e.g. a proxy's HTML 502. */
function fallbackErrorMessage(status: number): string {
  if (status === 413) return "That upload is too large.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status === 401) return "Your session has ended. Please sign in again.";
  if (status >= 500) return "The API is having trouble right now. Please try again in a moment.";
  return "The request could not be completed.";
}

export function formatInr(value: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}
