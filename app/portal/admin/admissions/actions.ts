"use server";
import {redirect} from "next/navigation";
import {requireAdmissionsStaff} from "../../../../lib/supabase/admin";
const statuses=["pending","under_review","accepted","rejected","waitlisted"] as const;
export async function updateApplicationReview(form:FormData){
  const {supabase,user}=await requireAdmissionsStaff();const id=String(form.get("id")||"");const status=String(form.get("status")||"");const admin_notes=String(form.get("admin_notes")||"").trim();
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)||!statuses.includes(status as typeof statuses[number])||admin_notes.length>4000)redirect("/portal/admin/admissions?error=invalid");
  const {error}=await supabase.from("admission_applications").update({status,admin_notes,reviewed_by:user.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);
  if(error)redirect("/portal/admin/admissions?error=save");
  redirect("/portal/admin/admissions?saved=1");
}
export async function downloadApplicationDocument(form:FormData){
  const {supabase}=await requireAdmissionsStaff();const id=String(form.get("id")||"");
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))redirect("/portal/admin/admissions?error=file");
  const {data}=await supabase.from("admission_applications").select("document_path").eq("id",id).single();
  if(!data?.document_path||!data.document_path.startsWith("incoming/SLA-"))redirect("/portal/admin/admissions?error=file");
  const {data:signed,error}=await supabase.storage.from("admission-documents").createSignedUrl(data.document_path,60);
  if(error||!signed?.signedUrl)redirect("/portal/admin/admissions?error=file");
  redirect(signed.signedUrl);
}
