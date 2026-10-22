import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { PortalFrame } from "../portal-frame";
export default async function StudentPortal() {
  const db=await createClient(); if(!db) redirect("/login?error=setup");
  const {data:{user}}=await db.auth.getUser(); if(!user) redirect("/login");
  const {data:p}=await db.from("profiles").select("display_name,role,active").eq("id",user.id).single();
  if(!p?.active || p.role!=="student") redirect("/portal");
  return <PortalFrame title="Student portal" name={p.display_name||"Student"} role="Student"><div className="portal-empty"><h2>Your learning, in one place.</h2><p>Timetable, attendance, class notices and results will appear here when the school connects its academic records.</p><span className="status-pill">Account active</span></div></PortalFrame>;
}
