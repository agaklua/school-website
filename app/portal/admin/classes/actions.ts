"use server";
import {redirect} from "next/navigation";
import {requirePermission} from "../../../../lib/supabase/admin";
export async function createClass(form:FormData) {
  const {supabase}=await requirePermission("academics.manage");
  const name=String(form.get("name")||"").trim(); const school_level=String(form.get("school_level")||""); const academic_year_id=Number(form.get("academic_year_id")); const capacity=Number(form.get("capacity")||0);
  if(name.length<1||name.length>80||!["baby_class","kindergarten","primary","secondary"].includes(school_level)||!Number.isSafeInteger(academic_year_id)||academic_year_id<1||!Number.isSafeInteger(capacity)||capacity<0||capacity>5000) redirect("/portal/admin/classes?error=invalid");
  const {error}=await supabase.from("school_classes").insert({name,school_level,academic_year_id,capacity});
  if(error) redirect(`/portal/admin/classes?error=${error.code==="23505"?"duplicate":"save"}`);
  redirect("/portal/admin/classes?saved=1");
}
