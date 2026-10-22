"use server";
import {redirect} from "next/navigation";
import {requirePermission} from "../../../../lib/supabase/admin";
const root="/portal/admin/teachers";
const teacherId=(value:FormDataEntryValue|null)=>String(value||"");
const validUuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function createTeacherProfile(form:FormData) {
  const {supabase,user}=await requirePermission("teachers.manage");
  const profile_id=teacherId(form.get("profile_id")); const full_name=String(form.get("full_name")||"").trim(); const staff_number=String(form.get("staff_number")||"").trim().toUpperCase();
  const phone=String(form.get("phone")||"").trim(); const work_email=String(form.get("work_email")||"").trim().toLowerCase(); const job_title=String(form.get("job_title")||"Teacher").trim(); const hired_on=String(form.get("hired_on")||"");
  if(!validUuid(profile_id)||full_name.length<2||full_name.length>160||!/^[A-Z0-9/-]{3,32}$/.test(staff_number)||phone.length<6||phone.length>40||job_title.length<2||job_title.length>100||(work_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(work_email))||(hired_on&&!/^\d{4}-\d\d-\d\d$/.test(hired_on))) redirect(`${root}?error=invalid`);
  const {data:profile}=await supabase.from("profiles").select("role,active").eq("id",profile_id).maybeSingle();
  if(profile?.role!=="teacher"||!profile.active) redirect(`${root}?error=account`);
  const {error}=await supabase.from("teacher_profiles").insert({profile_id,full_name,staff_number,phone,work_email:work_email||null,job_title,hired_on:hired_on||null,employment_status:"active",created_by:user.id});
  if(error) redirect(`${root}?error=${error.code==="23505"?"duplicate":"save"}`);
  redirect(`${root}?saved=1`);
}

export async function updateTeacherProfile(form:FormData) {
  const {supabase}=await requirePermission("teachers.manage"); const id=teacherId(form.get("id"));
  const full_name=String(form.get("full_name")||"").trim(); const phone=String(form.get("phone")||"").trim(); const work_email=String(form.get("work_email")||"").trim().toLowerCase(); const job_title=String(form.get("job_title")||"").trim(); const employment_status=String(form.get("employment_status")||"");
  if(!validUuid(id)||full_name.length<2||full_name.length>160||phone.length<6||phone.length>40||job_title.length<2||job_title.length>100||(work_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(work_email))||!["active","on_leave","suspended","resigned","terminated"].includes(employment_status)) redirect(`${root}/${id}?error=invalid`);
  const {error}=await supabase.from("teacher_profiles").update({full_name,phone,work_email:work_email||null,job_title,employment_status,updated_at:new Date().toISOString()}).eq("id",id);
  if(error) redirect(`${root}/${id}?error=save`);
  redirect(`${root}/${id}?saved=1`);
}

export async function assignTeachingResponsibility(form:FormData) {
  const {supabase,user}=await requirePermission("teachers.manage"); const id=teacherId(form.get("teacher_profile_id"));
  const class_id=Number(form.get("class_id")); const subject_id=Number(form.get("subject_id")); const academic_year_id=Number(form.get("academic_year_id"));
  if(!validUuid(id)||![class_id,subject_id,academic_year_id].every(x=>Number.isSafeInteger(x)&&x>0)) redirect(`${root}/${id}?error=invalid`);
  const {error}=await supabase.from("teaching_assignments").insert({teacher_profile_id:id,class_id,subject_id,academic_year_id,is_active:true,assigned_by:user.id});
  if(error) redirect(`${root}/${id}?error=${error.code==="23505"?"duplicate":"assignment"}`);
  redirect(`${root}/${id}?saved=assignment`);
}

export async function removeTeachingResponsibility(form:FormData) {
  const {supabase,user}=await requirePermission("teachers.manage"); const id=teacherId(form.get("teacher_profile_id")); const assignment=teacherId(form.get("assignment_id"));
  if(!validUuid(id)||!validUuid(assignment)) redirect(`${root}/${id}?error=invalid`);
  const {error}=await supabase.from("teaching_assignments").update({is_active:false,ended_by:user.id,ended_at:new Date().toISOString()}).eq("id",assignment).eq("teacher_profile_id",id).eq("is_active",true);
  if(error) redirect(`${root}/${id}?error=assignment`);
  redirect(`${root}/${id}?saved=removed`);
}

export async function addTeacherTimetable(form:FormData) {
  const {supabase,user}=await requirePermission("teachers.manage"); const profile=teacherId(form.get("teacher_profile_id")); const assignment_id=teacherId(form.get("assignment_id"));
  const weekday=Number(form.get("weekday")); const starts_at=String(form.get("starts_at")||""); const ends_at=String(form.get("ends_at")||""); const room=String(form.get("room")||"").trim();
  if(!validUuid(profile)||!validUuid(assignment_id)||!Number.isInteger(weekday)||weekday<1||weekday>5||!/^\d\d:\d\d$/.test(starts_at)||!/^\d\d:\d\d$/.test(ends_at)||starts_at>=ends_at||room.length>80) redirect(`${root}/${profile}?error=timetable`);
  const {error}=await supabase.from("teacher_timetables").insert({assignment_id,weekday,starts_at,ends_at,room,created_by:user.id});
  if(error) redirect(`${root}/${profile}?error=${error.code==="23505"?"duplicate-time":"overlap"}`);
  redirect(`${root}/${profile}?saved=timetable`);
}
