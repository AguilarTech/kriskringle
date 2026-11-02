// HTTP helpers shared by all edge functions.
//
// Rule: error responses carry a fixed, safe message only. They never echo the
// request body, raw message text, pairings or member ids.

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Wraps a handler with CORS, method checking and error mapping.
 * Unexpected errors are logged by name only, so nothing sensitive reaches the logs.
 */
export function handler(
  fn: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }
    try {
      return await fn(req);
    } catch (err) {
      if (err instanceof HttpError) {
        const body: Record<string, unknown> = { error: err.message };
        if (err.details !== undefined) body.details = err.details;
        return json(body, err.status);
      }
      console.error("unhandled error:", err instanceof Error ? err.name : typeof err);
      return json({ error: "Internal error" }, 500);
    }
  };
}

/** Parses a JSON body, or throws a 400 that doesn't repeat the body. */
export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Body must be valid JSON");
  }
}
