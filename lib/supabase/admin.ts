import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./server";

export async function requireRole(allowed: string[]) {
  const supabase = await createClient();
  if (!supabase) redirect("/login?error=setup");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("display_name,role,active").eq("id", user.id).maybeSingle();
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
  if (!allowed.includes(profile.role)) redirect("/portal");
  return { supabase, profile, user };
}

export async function requirePermission(permission: string) {
  const context = await requireRole(["super_admin", "school_admin", "teacher", "parent", "student", "bursar", "boarding_staff", "admissions_officer"]);
  const { data, error } = await context.supabase.rpc("has_school_permission", { p_permission: permission });
  if (error || data !== true) redirect("/login?error=forbidden");
  return context;
}

export async function requireSchoolAdmin() {
  return requireRole(["school_admin", "super_admin"]);
}

export async function requireAdmissionsStaff() {
  return requireRole(["super_admin", "school_admin", "admissions_officer"]);
}
