import {requirePermission} from "../../../../lib/supabase/admin";
import {PortalFrame} from "../../portal-frame";
import {createSubject} from "./actions";
const levels:Record<string,string>={baby_class:"Baby class",kindergarten:"Kindergarten",primary:"Primary",secondary:"Secondary"};
export default async function Subjects({searchParams}:{searchParams:Promise<{error?:string;saved?:string}>}) {
  const {supabase,profile}=await requirePermission("academics.manage");const [{data,error},params]=await Promise.all([supabase.from("subjects").select("id,name,school_level,active").order("school_level").order("name"),searchParams]);
  const messages:Record<string,string>={invalid:"Enter a subject name and select a school level.",duplicate:"That subject already exists for this school level.",save:"The subject could not be saved."};
  return <PortalFrame title="Subject Management" name={profile.display_name||"School staff"} role={profile.role.replaceAll("_"," ")}>
    {params.error&&<p role="alert" className="form-error">{messages[params.error]||"Unable to save."}</p>}{params.saved&&<p role="status" className="form-success">Subject added successfully.</p>}{error&&<p role="alert" className="form-error">Could not load subjects. Confirm migration 004 is applied.</p>}
    <div className="dashboard-columns"><section className="dashboard-panel"><h2>Subjects offered</h2>{data?.length?data.map(s=><div className="dashboard-row" key={s.id}><span>{s.name}</span><span className="status-pill">{levels[s.school_level]} · {s.active?"Active":"Inactive"}</span></div>):<p className="empty-state">No subjects have been added yet.</p>}</section><section className="dashboard-panel"><h2>Add subject</h2><form action={createSubject} className="student-form"><label>Subject name<input name="name" required maxLength={100}/></label><label>School level<select name="school_level" required defaultValue=""><option value="" disabled>Select level</option>{Object.entries(levels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><button className="button button-gold">Save subject</button></form></section></div>
  </PortalFrame>;
}
