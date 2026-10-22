"use server";
import { redirect } from "next/navigation";
import { requireSchoolAdmin } from "../../../../lib/supabase/admin";

export async function saveIdentity(formData: FormData) {
  const { supabase } = await requireSchoolAdmin();
  const take = (key: string, max: number) => String(formData.get(key) ?? "").trim().slice(0, max);
  const school_name = take("school_name", 100), acronym = take("acronym", 16), motto = take("motto", 160), country = take("country", 80);
  const address = take("address", 200), phone = take("phone", 40), email = take("email", 254), logo_url = take("logo_url", 500);
  const primary_color = take("primary_color", 7), accent_color = take("accent_color", 7);
  if (!school_name || !acronym || !motto || !country || !/^#[0-9a-fA-F]{6}$/.test(primary_color) || !/^#[0-9a-fA-F]{6}$/.test(accent_color)) redirect("/portal/admin/settings?error=invalid");
  const contrastAgainstWhite = (hex: string) => {
    const rgb = hex.slice(1).match(/.{2}/g)!.map(v => parseInt(v,16)/255).map(v => v <= 0.04045 ? v/12.92 : ((v+0.055)/1.055)**2.4);
    return 1.05 / (0.2126*rgb[0] + 0.7152*rgb[1] + 0.0722*rgb[2] + 0.05);
  };
  if (contrastAgainstWhite(primary_color) < 4.5 || contrastAgainstWhite(accent_color) < 4.5) redirect("/portal/admin/settings?error=contrast");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/portal/admin/settings?error=email");
  if (logo_url && !logo_url.startsWith("/") && !/^https:\/\//i.test(logo_url)) redirect("/portal/admin/settings?error=logo");
  const { error } = await supabase.from("school_settings").upsert({ id: 1, school_name, acronym, motto, country, address, phone, email, logo_url, primary_color, accent_color, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) redirect("/portal/admin/settings?error=save");
  redirect("/portal/admin/settings?saved=1");
}
