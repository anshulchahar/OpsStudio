import { serverSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const db = await serverSupabase();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/studio", url.origin));
  }
  return NextResponse.redirect(
    new URL(
      "/login?message=The+sign-in+link+has+expired.+Please+try+again.",
      url.origin,
    ),
  );
}
