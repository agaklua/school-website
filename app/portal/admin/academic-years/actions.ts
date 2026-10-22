"use server";
import { redirect } from "next/navigation";
import { requirePermission } from "../../../../lib/supabase/admin";
export async function createAcademicYear(form:FormData) {
  const {supabase}=await requirePermission("academics.manage");
  const name=String(form.get("name")||"").trim(); const starts_on=String(form.get("starts_on")||""); const ends_on=String(form.get("ends_on")||""); const active=form.get("active")==="on";
  const validDate=(s:string)=>/^\d{4}-\d\d-\d\d$/.test(s)&&!Number.isNaN(Date.parse(`${s}T00:00:00Z`))&&new Date(`${s}T00:00:00Z`).toISOString().slice(0,10)===s;
  if(name.length<4||name.length>40||!validDate(starts_on)||!validDate(ends_on)||ends_on<starts_on) redirect("/portal/admin/academic-years?error=invalid");
  const {data,error}=await supabase.from("academic_years").insert({name,starts_on,ends_on,active:false}).select("id").single();
  if(error||!data) redirect(`/portal/admin/academic-years?error=${error?.code==="23505"?"duplicate":"save"}`);
  if(active) { const {error:activateError}=await supabase.rpc("activate_academic_year",{p_id:data.id}); if(activateError) redirect("/portal/admin/academic-years?error=activate"); }
  redirect("/portal/admin/academic-years?saved=1");
}
