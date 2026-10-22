import "server-only";
import { createClient } from "./supabase/server";

export type Announcement = { id: number; title: string; summary: string; category: string; published_at: string };
export async function getPublicAnnouncements(): Promise<Announcement[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.from("announcements").select("id,title,summary,category,published_at")
    .eq("published", true).lte("published_at", new Date().toISOString()).order("published_at", { ascending: false }).limit(3);
  return (data || []) as Announcement[];
}
export async function getAllPublicAnnouncements(): Promise<Announcement[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.from("announcements").select("id,title,summary,category,published_at")
    .eq("published", true).lte("published_at", new Date().toISOString()).order("published_at", { ascending: false }).limit(100);
  return (data || []) as Announcement[];
}
