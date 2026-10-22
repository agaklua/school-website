import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") || "/portal";
  let destination = new URL("/portal", request.url);
  try {
    const candidate = new URL(next, request.url);
    if (candidate.origin === request.nextUrl.origin) destination = candidate;
  } catch { /* Keep the same-origin default. */ }
  const supabase = await createClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(destination);
  }
  return NextResponse.redirect(new URL("/login?error=expired", request.url));
}
