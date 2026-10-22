import Link from "next/link";
import {requirePermission} from "../../../../lib/supabase/admin";
import {PortalFrame} from "../../portal-frame";
import {createTeacherProfile} from "./actions";
const errors:Record<string,string>={invalid:"Check the staff number, contact details and employment information.",account:"Choose an active account whose role is Teacher.",duplicate:"That account or staff number is already linked to a teacher profile.",save:"The teacher profile could not be saved. Confirm migration 005 is applied."};
export default async function Teachers({searchParams}:{searchParams:Promise<{error?:string;saved?:string;q?:string}>}) {
  const {supabase,profile}=await requirePermission("teachers.manage"); const params=await searchParams; const q=(params.q||"").trim().slice(0,40).replace(/[^a-zA-Z0-9/-]/g,"");
  let listQuery=supabase.from("teacher_profiles").select("id,profile_id,full_name,staff_number,phone,work_email,job_title,employment_status,hired_on",{count:"exact"});
  if(q) listQuery=listQuery.ilike("staff_number",`%${q}%`);
  const [{data:teachers,count,error},{data:accounts}]=await Promise.all([listQuery.order("staff_number").limit(50),supabase.from("profiles").select("id,display_name").eq("role","teacher").eq("active",true).order("display_name")]);
  const current=new Set((teachers||[]).map(t=>t.profile_id)); const available=(accounts||[]).filter(a=>!current.has(a.id));
  return <PortalFrame title="Teacher Management" name={profile.display_name||"Administrator"} role="Administrator">
    {params.error&&<p role="alert" className="form-error">{errors[params.error]||"Could not complete the teacher management action."}</p>}{params.saved&&<p role="status" className="form-success">Teacher record updated.</p>}{error&&<p role="alert" className="form-error">Teacher profiles could not be loaded. Confirm migration 005 is applied.</p>}
    <div className="page-title-row"><div><span className="eyebrow">STAFF RECORDS</span><p>Private staff directory, teaching assignments and timetable access.</p></div></div>
    <form method="get" className="student-search"><label>Find staff number<input name="q" defaultValue={params.q||""} maxLength={40} placeholder="Staff identification number"/></label><button className="button button-gold">Search</button></form>
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Staff ID</th><th>Teacher</th><th>Contact</th><th>Position</th><th>Employment</th><th></th></tr></thead><tbody>{teachers?.map(t=><tr key={t.id}><td>{t.staff_number}</td><td>{t.full_name}</td><td>{t.phone}<br/>{t.work_email||""}</td><td>{t.job_title}</td><td><span className="status-pill">{t.employment_status.replaceAll("_"," ")}</span></td><td><Link className="text-link" href={`/portal/admin/teachers/${t.id}`}>Manage ↗</Link></td></tr>)}</tbody></table></div>
    {!teachers?.length&&!error&&<p className="empty-state">No teacher profiles found. Create or activate teacher Auth accounts first.</p>}
    {!q&&available.length>0&&<section className="dashboard-panel teacher-create"><h2>Create teacher profile</h2><p>Only active accounts already assigned the Teacher role can be linked here. Account roles are provisioned separately by a trusted administrator.</p><form action={createTeacherProfile} className="form-grid">
      <label>Teacher account<select name="profile_id" required defaultValue=""><option value="" disabled>Select a teacher account</option>{available.map(a=><option key={a.id} value={a.id}>{a.display_name||a.id}</option>)}</select></label>
      <label>Teacher full name<input name="full_name" required minLength={2} maxLength={160}/></label>
      <label>Staff identification number<input name="staff_number" required minLength={3} maxLength={32}/></label>
      <label>Contact telephone<input name="phone" type="tel" required minLength={6} maxLength={40}/></label>
      <label>Work email<input name="work_email" type="email" maxLength={254}/></label>
      <label>Position<input name="job_title" defaultValue="Teacher" required maxLength={100}/></label>
      <label>Employment start date<input name="hired_on" type="date"/></label>
      <button className="button button-gold full">Create teacher profile</button>
    </form></section>}
  </PortalFrame>;
}
