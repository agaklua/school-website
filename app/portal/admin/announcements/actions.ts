"use server";
import { redirect } from "next/navigation";
import { requireSchoolAdmin } from "../../../../lib/supabase/admin";

export async function addAnnouncement(formData: FormData) {
  const { supabase, profile } = await requireSchoolAdmin();
  const title = String(formData.get("title") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const category = String(formData.get("category") || "School news").trim();
  const published = formData.get("published") === "on";
  if (!title || title.length > 140 || !summary || summary.length > 300 || body.length > 12000 || !category || category.length > 50) redirect("/portal/admin/announcements?error=invalid");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("announcements").insert({ title, summary, body, category, published, published_at: new Date().toISOString(), created_by: user.id });
  if (error) redirect("/portal/admin/announcements?error=save");
  redirect(`/portal/admin/announcements?saved=${published ? "published" : "draft"}`);
}

export async function setAnnouncementPublished(formData: FormData) {
  const { supabase } = await requireSchoolAdmin();
  const id = Number(formData.get("id"));
  const published = formData.get("published") === "true";
  if (!Number.isSafeInteger(id) || id < 1) redirect("/portal/admin/announcements?error=invalid");
  const { error } = await supabase.from("announcements").update({ published, published_at: published ? new Date().toISOString() : undefined, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) redirect("/portal/admin/announcements?error=save");
  redirect(`/portal/admin/announcements?saved=${published ? "published" : "unpublished"}`);
}
