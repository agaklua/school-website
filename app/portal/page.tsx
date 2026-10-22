import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { roleDetails, type SchoolRole } from "../../lib/roles";
export default async function PortalHome() {
  const supabase = await createClient();
  if (!supabase) redirect("/login?error=setup");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role,display_name,active").eq("id", user.id).single();
  if (!profile?.active || !(profile.role in roleDetails)) redirect("/login?error=credentials");
  redirect(roleDetails[profile.role as SchoolRole].destination);
}
