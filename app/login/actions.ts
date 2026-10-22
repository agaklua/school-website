"use server";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !email.includes("@") || password.length < 8) redirect("/login?error=invalid");
  const supabase = await createClient();
  if (!supabase) redirect("/login?error=setup");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) redirect("/login?error=credentials");
  const { data: profile } = await supabase.from("profiles").select("role,active").eq("id", data.user.id).maybeSingle();
  if (!profile || !profile.active) {
    await supabase.auth.signOut();
    redirect("/login?error=inactive");
  }
  if (profile.role === "teacher") {
    const { data: staff } = await supabase.from("teacher_profiles").select("employment_status").maybeSingle();
    if (!staff || staff.employment_status !== "active") {
      await supabase.auth.signOut();
      redirect("/login?error=inactive");
    }
  }
  const { roleDetails } = await import("../../lib/roles");
  if (!(profile.role in roleDetails)) {
    await supabase.auth.signOut();
    redirect("/login?error=role");
  }
  redirect(roleDetails[profile.role as keyof typeof roleDetails].destination);
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/login?error=reset");
  const supabase = await createClient();
  if (!supabase) redirect("/login?error=setup");
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset-password` });
  if (error) redirect("/login?error=reset");
  redirect("/login?sent=1");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) redirect("/reset-password?error=password");
  const supabase = await createClient();
  if (!supabase) redirect("/login?error=setup");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=expired");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/reset-password?error=save");
  redirect("/login?updated=1");
}
