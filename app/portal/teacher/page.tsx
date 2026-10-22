import {redirect} from "next/navigation";
import Link from "next/link";
import {requireRole} from "../../../lib/supabase/admin";
import {PortalFrame} from "../portal-frame";
const days=["","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
export default async function TeacherPortal() {
  const {supabase,profile}=await requireRole(["teacher"]);
  const {data:teacher,error:teacherError}=await supabase.from("teacher_profiles").select("id,full_name,staff_number,job_title,employment_status").maybeSingle();
  if(teacherError) return <PortalFrame title="Teacher dashboard" name={profile.display_name||"Teacher"} role="Teacher"><div className="portal-empty"><h2>Teacher workspace setup</h2><p>Teacher records are not available yet. Ask the school administrator to apply migration 005 and create your staff profile.</p></div></PortalFrame>;
  if(!teacher||teacher.employment_status!=="active") return <PortalFrame title="Teacher dashboard" name={profile.display_name||"Teacher"} role="Teacher"><div className="portal-empty"><h2>Teaching access unavailable</h2><p>Your staff profile is not active. Contact the school administrator for assistance.</p></div></PortalFrame>;
  const {data:assignments,error}=await supabase.from("teaching_assignments").select("id,class_id,subject_id,academic_year_id,class:school_classes(name,school_level),subject:subjects(name),academic_year:academic_years(name,active),teacher_timetables(id,weekday,starts_at,ends_at,room)").eq("teacher_profile_id",teacher.id).eq("is_active",true).order("assigned_at");
  if(error) return <PortalFrame title="Teacher dashboard" name={profile.display_name||"Teacher"} role="Teacher"><div className="portal-empty"><h2>Could not load teaching assignments</h2><p>Refresh the workspace or contact the school administrator.</p></div></PortalFrame>;
  const activeAssignments=(assignments||[]).filter(a=>Array.isArray(a.academic_year)?a.academic_year[0]?.active:(a.academic_year as {active?:boolean}|null)?.active);
  const classIds=[...new Set(activeAssignments.map(a=>a.class_id))];
  const rosters=await Promise.all(classIds.map(async id=>{
    const {data}=await supabase.from("students").select("id,admission_number,full_name,enrollment_status").eq("class_id",id).eq("enrollment_status","enrolled").order("full_name");
    const item=activeAssignments.find(a=>a.class_id===id); const cls=item?(Array.isArray(item.class)?item.class[0]:item.class as {name?:string;school_level?:string}|null):null;
    return {id,name:cls?.name||"Class",level:cls?.school_level||"",students:data||[]};
  }));
  return <PortalFrame title="Teacher dashboard" name={profile.display_name||"Teacher"} role="Teacher">
    <div className="teacher-summary"><div><span className="eyebrow">STAFF ID · {teacher.staff_number}</span><h2>{teacher.full_name} · {teacher.job_title}</h2><p>Your active classes, subjects, timetable and authorized student rosters.</p></div><Link className="button button-gold" href="/portal/teacher/attendance">Take attendance</Link></div>
    {!activeAssignments.length?<div className="portal-empty"><h2>No active responsibilities</h2><p>Ask a school administrator to assign your classes and subjects for the active academic year.</p></div>:<>
      <section className="dashboard-columns"><article className="dashboard-panel"><h2>Assigned classes</h2>{rosters.map(r=><div className="dashboard-row" key={r.id}><span>{r.name} · {r.level.replaceAll("_"," ")}</span><b>{r.students.length} students</b></div>)}</article><article className="dashboard-panel"><h2>Weekly timetable</h2>{activeAssignments.flatMap(a=>{const c=Array.isArray(a.class)?a.class[0]:a.class as {name?:string}|null;const s=Array.isArray(a.subject)?a.subject[0]:a.subject as {name?:string}|null;return (a.teacher_timetables||[]).map(slot=><div className="dashboard-row" key={slot.id}><span>{days[slot.weekday]} · {slot.starts_at.slice(0,5)}–{slot.ends_at.slice(0,5)}<br/>{c?.name} · {s?.name}</span><small>{slot.room||"—"}</small></div>)})}{activeAssignments.every(a=>!a.teacher_timetables?.length)&&<p className="empty-state">No timetable slots have been added yet.</p>}</article></section>
      <section className="teacher-rosters"><h2>Authorized student rosters</h2>{rosters.map(r=><article className="dashboard-panel" key={r.id}><div className="review-heading"><div><span className="eyebrow">{r.level.replaceAll("_"," ")}</span><h3>{r.name}</h3></div><Link className="text-link" href={`/portal/teacher/attendance?class_id=${r.id}`}>Take attendance ↗</Link></div>{r.students.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Admission number</th><th>Student</th><th>Enrollment</th></tr></thead><tbody>{r.students.map(student=><tr key={student.id}><td>{student.admission_number}</td><td>{student.full_name}</td><td>{student.enrollment_status}</td></tr>)}</tbody></table></div>:<p className="empty-state">No enrolled students in this class.</p>}</article>)}</section>
    </>}
  </PortalFrame>;
}
