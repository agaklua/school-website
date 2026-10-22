"use server";
import { redirect } from "next/navigation";
import { requirePermission } from "../../../../lib/supabase/admin";

function validPhoto(file: File) {
  return file.size <= 5 * 1024 * 1024 && ["image/jpeg","image/png","image/webp"].includes(file.type);
}

export async function registerStudent(form: FormData) {
  const { supabase, user } = await requirePermission("students.manage");
  const admission_number = String(form.get("admission_number") ?? "").trim().toUpperCase();
  const full_name = String(form.get("full_name") ?? "").trim();
  const date_of_birth = String(form.get("date_of_birth") ?? "");
  const school_level = String(form.get("school_level") ?? "");
  const class_raw = String(form.get("class_id") ?? "");
  const year_raw = String(form.get("academic_year_id") ?? "");
  const enrollment_status = String(form.get("enrollment_status") ?? "enrolled");
  const admission_date = String(form.get("admission_date") ?? "");
  const guardian_name = String(form.get("guardian_name") ?? "").trim();
  const guardian_email = String(form.get("guardian_email") ?? "").trim().toLowerCase();
  const guardian_phone = String(form.get("guardian_phone") ?? "").trim();
  const guardian_relationship = String(form.get("guardian_relationship") ?? "").trim();
  const photo = form.get("photo");
  const levels = ["baby_class","kindergarten","primary","secondary"];
  if (!/^[A-Z0-9/-]{3,32}$/.test(admission_number) || full_name.length < 2 || full_name.length > 160 || !/^\d{4}-\d\d-\d\d$/.test(date_of_birth) || date_of_birth >= new Date().toISOString().slice(0,10) || !levels.includes(school_level) || !/^\d+$/.test(year_raw) || !["enrolled","pending"].includes(enrollment_status) || !/^\d{4}-\d\d-\d\d$/.test(admission_date) || guardian_name.length < 2 || guardian_phone.length < 6 || guardian_phone.length > 40 || guardian_relationship.length < 2 || guardian_relationship.length > 40 || (guardian_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardian_email))) redirect("/portal/admin/students/new?error=invalid");
  if (photo instanceof File && photo.size > 0 && !validPhoto(photo)) redirect("/portal/admin/students/new?error=photo");
  const class_id = class_raw ? Number(class_raw) : null;
  if (class_raw && (!Number.isSafeInteger(class_id) || Number(class_id) <= 0)) redirect("/portal/admin/students/new?error=invalid");
  const studentId = crypto.randomUUID();
  const { error } = await supabase.rpc("register_student", { p_student_id: studentId, p_admission_number: admission_number, p_full_name: full_name, p_date_of_birth: date_of_birth, p_school_level: school_level, p_class_id: class_id, p_academic_year_id: Number(year_raw), p_enrollment_status: enrollment_status, p_admission_date: admission_date, p_guardian_name: guardian_name, p_guardian_email: guardian_email, p_guardian_phone: guardian_phone, p_guardian_relationship: guardian_relationship });
  if (error) redirect(`/portal/admin/students/new?error=${encodeURIComponent(error.message.includes("duplicate key") ? "duplicate" : "save")}`);
  let imageWarning = false;
  if (photo instanceof File && photo.size > 0) {
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const validSignature = (photo.type === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) || (photo.type === "image/png" && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) || (photo.type === "image/webp" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP");
    if (validSignature) {
      const ext = photo.type === "image/jpeg" ? "jpg" : photo.type === "image/png" ? "png" : "webp";
      const path = `${studentId}/profile.${ext}`;
      const { error: uploadError } = await supabase.storage.from("student-photos").upload(path, photo, { contentType: photo.type, upsert: false });
      if (!uploadError) await supabase.from("students").update({ photo_path: path }).eq("id", studentId).eq("created_by", user.id);
      else imageWarning = true;
    } else imageWarning = true;
  }
  redirect(`/portal/admin/students?saved=1${imageWarning ? "&photo=failed" : ""}`);
}
