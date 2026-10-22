"use server";
import {redirect} from "next/navigation";
import {requirePermission} from "../../../../lib/supabase/admin";
import {schoolToday} from "../../../../lib/school-time";
export async function saveStaffAttendance(form:FormData) {
  const {supabase}=await requirePermission("staff_attendance.manage"); const schoolDay=String(form.get("school_day")||"");
  const valid=/^\d{4}-\d\d-\d\d$/.test(schoolDay)&&!Number.isNaN(Date.parse(`${schoolDay}T00:00:00Z`))&&new Date(`${schoolDay}T00:00:00Z`).toISOString().slice(0,10)===schoolDay&&schoolDay<=schoolToday();
  if(!valid) redirect("/portal/admin/staff-attendance?error=invalid");
  const {data:staff,error:staffError}=await supabase.from("teacher_profiles").select("profile_id").eq("employment_status","active").limit(500);
  if(staffError) redirect("/portal/admin/staff-attendance?error=load"); if(!staff?.length) redirect("/portal/admin/staff-attendance?error=empty");
  const values=new Set(["present","absent","late","excused"]);
  const rows=staff.map(item=>({profile_id:item.profile_id,status:String(form.get(`status_${item.profile_id}`)||""),note:String(form.get(`note_${item.profile_id}`)||"").trim().slice(0,300)}));
  if(rows.some(row=>!values.has(row.status))) redirect("/portal/admin/staff-attendance?error=invalid");
  const {error}=await supabase.rpc("record_staff_attendance",{p_school_day:schoolDay,p_records:rows});
  if(error) redirect("/portal/admin/staff-attendance?error=save");
  redirect(`/portal/admin/staff-attendance?school_day=${schoolDay}&saved=1`);
}
