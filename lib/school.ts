import "server-only";
import { createClient } from "./supabase/server";

export type SchoolIdentity = {
  school_name: string;
  acronym: string;
  motto: string;
  country: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string;
  primary_color: string;
  accent_color: string;
};
export const defaultIdentity: SchoolIdentity = {
  school_name: "St. Lawrence Academy", acronym: "SLA", motto: "Education is the key of life",
  country: "South Sudan", address: "", phone: "+211 926 100 446", email: "achiermjohnsla@gmail.com", logo_url: "/images/crest.jpg",
  primary_color: "#17264b", accent_color: "#a21d2a",
};

export async function getSchoolIdentity(): Promise<SchoolIdentity> {
  const supabase = await createClient();
  if (!supabase) return defaultIdentity;
  const { data } = await supabase.from("school_settings").select("school_name,acronym,motto,country,address,phone,email,logo_url,primary_color,accent_color").eq("id", 1).maybeSingle();
  const saved = data || {};
  return { ...defaultIdentity, ...saved, phone: saved.phone || defaultIdentity.phone, email: saved.email || defaultIdentity.email };
}
