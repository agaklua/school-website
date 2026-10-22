"use server";
import {redirect} from "next/navigation";
import {requirePermission} from "../../../../lib/supabase/admin";
export async function createSubject(form:FormData) {
  const {supabase}=await requirePermission("academics.manage");const name=String(form.get("name")||"").trim();const school_level=String(form.get("school_level")||"");
  if(name.length<1||name.length>100||!["baby_class","kindergarten","primary","secondary"].includes(school_level))redirect("/portal/admin/subjects?error=invalid");
  const {error}=await supabase.from("subjects").insert({name,school_level,active:true});
  if(error)redirect(`/portal/admin/subjects?error=${error.code==="23505"?"duplicate":"save"}`);
  redirect("/portal/admin/subjects?saved=1");
}
