import type { Metadata } from "next";
import { requireSchoolAdmin } from "../../../../lib/supabase/admin";
import { defaultIdentity } from "../../../../lib/school";
import { PortalFrame } from "../../portal-frame";
import { IdentityForm } from "./identity-form";
export const metadata: Metadata = { title: "School identity settings" };
const messages: Record<string,string> = { invalid: "Please provide a school name, short name, motto, country and valid colours.", email: "Enter a valid email address.", logo: "Logo must be a local path or a secure HTTPS URL.", contrast: "Choose primary and accent colours dark enough for readable white text.", save: "Could not save these settings. Check that the identity migration has been applied." };
export default async function Settings({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { supabase, profile } = await requireSchoolAdmin();
  const [{ data }, query] = await Promise.all([supabase.from("school_settings").select("school_name,acronym,motto,country,address,phone,email,logo_url,primary_color,accent_color").eq("id",1).maybeSingle(), searchParams]);
  return <PortalFrame title="School identity" name={profile.display_name || "Administrator"} role="Administrator"><p className="portal-welcome">Update the name, motto, public contact details, logo and colours shown across the public website.</p>{query.saved && <p className="form-success" role="status">School identity saved and published.</p>}{query.error && <p className="form-error" role="alert">{messages[query.error] || "Unable to save school identity."}</p>}<IdentityForm school={{ ...defaultIdentity, ...(data || {}) }}/></PortalFrame>;
}
