// Supabase clients and caller checks for edge functions.
//
// The service-role client bypasses RLS. Use it only for reads the function needs
// and for calling the service-only RPCs (tech spec §5.7). All double-blind writes
// go through those RPCs, never through direct table writes.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { HttpError } from "./http.ts";

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export function serviceClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface Caller {
  userId: string;
  displayName: string;
  isAdmin: boolean;
}

function bearer(req: Request): string {
  const header = req.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw new HttpError(401, "Not signed in");
  return match[1];
}

/** Resolves the signed-in caller and their members row. 401 without a session, 403 if not a member. */
export async function requireMember(
  req: Request,
  db: SupabaseClient = serviceClient(),
): Promise<Caller> {
  const { data: userData, error: userError } = await db.auth.getUser(bearer(req));
  if (userError || !userData.user) throw new HttpError(401, "Not signed in");

  const { data: member, error } = await db
    .from("members")
    .select("id, display_name, is_admin")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (error) throw new Error("members lookup failed");
  if (!member) throw new HttpError(403, "Not invited");

  return { userId: member.id, displayName: member.display_name, isAdmin: member.is_admin };
}

export async function requireAdmin(
  req: Request,
  db: SupabaseClient = serviceClient(),
): Promise<Caller> {
  const caller = await requireMember(req, db);
  if (!caller.isAdmin) throw new HttpError(403, "Admin only");
  return caller;
}

/** For function-to-function calls (e.g. push-notify): the bearer must be the service-role key. */
export function requireServiceRole(req: Request): void {
  if (!isServiceRole(req)) throw new HttpError(403, "Service role only");
}

/** True when the bearer is the service-role key (another function, or the organiser from a terminal). */
export function isServiceRole(req: Request): boolean {
  const header = req.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return !!match && timingSafeEqual(match[1], env("SUPABASE_SERVICE_ROLE_KEY"));
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

export type Phase = "setup" | "drawn" | "closed";

export async function currentPhase(db: SupabaseClient): Promise<Phase> {
  const { data, error } = await db.from("app_state").select("phase").eq("id", 1).single();
  if (error || !data) throw new Error("app_state lookup failed");
  return data.phase as Phase;
}
