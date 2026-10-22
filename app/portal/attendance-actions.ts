"use server";
import {redirect} from "next/navigation";
import {requirePermission} from "../../lib/supabase/admin";
import {schoolToday} from "../../lib/school-time";

export async function saveStudentAttendance(form:FormData) {
  const {supabase,profile}=await requirePermission("attendance.manage");
  const classId=Number(form.get("class_id")); const schoolDay=String(form.get("school_day")||"");
  const dateValid=/^\d{4}-\d\d-\d\d$/.test(schoolDay)&&!Number.isNaN(Date.parse(`${schoolDay}T00:00:00Z`))&&new Date(`${schoolDay}T00:00:00Z`).toISOString().slice(0,10)===schoolDay;
  const dest=profile.role==="teacher"?"/portal/teacher/attendance":"/portal/admin/attendance";
  if(!Number.isSafeInteger(classId)||classId<1||!dateValid||schoolDay>schoolToday()) redirect(`${dest}?error=invalid`);
  const {data:schoolClass}=await supabase.from("school_classes").select("id").eq("id",classId).maybeSingle();
  if(!schoolClass) redirect(`${dest}?error=class`);
  const {data:roster,error:rosterError}=await supabase.from("students").select("id").eq("class_id",classId).eq("enrollment_status","enrolled").order("full_name").limit(1000);
  if(rosterError) redirect(`${dest}?error=load`);
  if(!roster?.length) redirect(`${dest}?error=empty`);
  const allowed=new Set(["present","absent","late","excused"]);
  const rows=roster.map(student=>({student_id:student.id,status:String(form.get(`status_${student.id}`)||"")}));
  if(rows.some(row=>!allowed.has(row.status))) redirect(`${dest}?error=invalid`);
  const {error}=await supabase.rpc("record_student_class_attendance",{p_class_id:classId,p_school_day:schoolDay,p_records:rows});
  if(error) redirect(`${dest}?error=save`);
  redirect(`${dest}?class_id=${classId}&school_day=${schoolDay}&saved=1`);
}
