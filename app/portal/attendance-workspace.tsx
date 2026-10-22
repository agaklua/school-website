import {requirePermission,requireRole} from "../../lib/supabase/admin";
import {PortalFrame} from "./portal-frame";
import {saveStudentAttendance} from "./attendance-actions";
import Link from "next/link";
import {schoolToday} from "../../lib/school-time";

export async function AttendanceWorkspace({admin,searchParams}:{admin:boolean;searchParams:Promise<{class_id?:string;school_day?:string;error?:string;saved?:string}>}) {
  const ctx=admin?await requireRole(["school_admin","super_admin"]):await requireRole(["teacher"]);
  await requirePermission("attendance.manage");
  const {data:allowedClasses,error:classError}=await ctx.supabase.from("school_classes").select("id,name,school_level").eq("active",true).order("school_level").order("name");
  const params=await searchParams; const today=schoolToday(); const requestedDate=params.school_day||today;
  const dateValid=/^\d{4}-\d\d-\d\d$/.test(requestedDate)&&!Number.isNaN(Date.parse(`${requestedDate}T00:00:00Z`))&&new Date(`${requestedDate}T00:00:00Z`).toISOString().slice(0,10)===requestedDate&&requestedDate<=today;
  const requestedClass=params.class_id?Number(params.class_id):(allowedClasses?.[0]?.id??0);
  const currentClass=allowedClasses?.find(item=>item.id===requestedClass);
  const {data:students}=currentClass&&dateValid?await ctx.supabase.from("students").select("id,admission_number,full_name").eq("class_id",currentClass.id).eq("enrollment_status","enrolled").order("full_name").limit(1000):{data:null};
  const {data:existing}=students?.length?await ctx.supabase.from("attendance_records").select("student_id,status").eq("class_id",currentClass!.id).eq("school_day",requestedDate).in("student_id",students.map(s=>s.id)):{data:null};
  const statusByStudent=new Map((existing||[]).map(item=>[item.student_id,item.status]));
  const counts=(existing||[]).reduce((acc,item)=>{acc[item.status]=(acc[item.status]||0)+1;return acc;},{} as Record<string,number>);
  const errMessages:Record<string,string>={invalid:"Choose a valid class and date no later than today.",class:"That class is not assigned to your account or is no longer active.",load:"Could not load the class roster.",empty:"This class has no enrolled students to mark.",save:"Attendance could not be saved. Your class access may have changed."};
  const title=admin?"Student Attendance":"My Class Attendance";
  return <PortalFrame title={title} name={ctx.profile.display_name||"School staff"} role={admin?ctx.profile.role.replaceAll("_"," "):"Teacher"}>
    {admin&&<p><Link className="text-link" href="/portal/admin/staff-attendance">Record staff attendance ↗</Link></p>}
    {params.error&&<p role="alert" className="form-error">{errMessages[params.error]||"Attendance action could not be completed."}</p>}{params.saved&&<p role="status" className="form-success">Attendance saved for {requestedDate}.</p>}{classError&&<p role="alert" className="form-error">Could not load authorized classes.</p>}
    <form method="get" className="attendance-filters"><label>Class<select name="class_id" required defaultValue={String(currentClass?.id||"")}><option value="" disabled>Select class</option>{allowedClasses?.map(item=><option value={item.id} key={item.id}>{item.name} · {item.school_level.replaceAll("_"," ")}</option>)}</select></label><label>School date<input type="date" name="school_day" max={today} defaultValue={requestedDate}/></label><button className="button button-gold">Load class</button></form>
    {!allowedClasses?.length?<div className="portal-empty"><h2>No authorized classes</h2><p>{admin?"Create an active class and academic year first.":"Ask an administrator to assign your teaching responsibilities for the active academic year."}</p></div>:!currentClass?<div className="portal-empty"><h2>Class unavailable</h2><p>This class is inactive or you do not have permission to manage its attendance.</p></div>:!dateValid?<p role="alert" className="form-error">Select a valid date no later than today.</p>:!students?.length?<div className="portal-empty"><h2>No enrolled students</h2><p>No enrolled students are assigned to {currentClass.name}.</p></div>:<>
      <div className="attendance-summary"><b>{currentClass.name}</b><span>{students.length} enrolled students</span><span>{counts.present||0} present</span><span>{counts.absent||0} absent</span><span>{counts.late||0} late</span><span>{counts.excused||0} excused</span></div>
      <form action={saveStudentAttendance} className="attendance-form"><input type="hidden" name="class_id" value={currentClass.id}/><input type="hidden" name="school_day" value={requestedDate}/><div className="table-wrap"><table className="data-table"><thead><tr><th>Admission number</th><th>Student</th><th>Attendance status</th></tr></thead><tbody>{students.map(student=><tr key={student.id}><td>{student.admission_number}</td><td>{student.full_name}</td><td><label className="sr-only" htmlFor={`status-${student.id}`}>Attendance status for {student.full_name}</label><select id={`status-${student.id}`} name={`status_${student.id}`} defaultValue={statusByStudent.get(student.id)||"present"}><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="excused">Excused</option></select></td></tr>)}</tbody></table></div><button className="button button-gold">Save attendance</button></form>
    </>}
  </PortalFrame>;
}
