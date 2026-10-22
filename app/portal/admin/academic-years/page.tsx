import Link from "next/link";
import { requirePermission } from "../../../../lib/supabase/admin";
import { PortalFrame } from "../../portal-frame";
import { createAcademicYear } from "./actions";
const messages:Record<string,string>={invalid:"Enter a name and valid start and end dates.",duplicate:"That academic year name already exists.",save:"The academic year could not be saved.",activate:"The year was saved, but could not be activated. Try again.",saved:"Academic year saved."};
export default async function AcademicYears({searchParams}:{searchParams:Promise<{error?:string;saved?:string}>}) {
  const {supabase,profile}=await requirePermission("academics.manage");
  const [{data, error},params]=await Promise.all([supabase.from("academic_years").select("id,name,starts_on,ends_on,active").order("starts_on",{ascending:false}),searchParams]);
  return <PortalFrame title="Academic Years" name={profile.display_name||"School staff"} role={profile.role.replaceAll("_"," ")}>
    {params.error&&<p role="alert" className="form-error">{messages[params.error]||"Unable to save."}</p>}{params.saved&&<p role="status" className="form-success">{messages.saved}</p>}{error&&<p role="alert" className="form-error">Could not load academic years. Confirm migration 004 is applied.</p>}
    <div className="dashboard-columns"><section className="dashboard-panel"><h2>Academic year records</h2>{data?.length?data.map(year=><div className="dashboard-row" key={year.id}><span><b>{year.name}</b><br/>{year.starts_on} to {year.ends_on}</span><span className="status-pill">{year.active?"Active":"Inactive"}</span></div>):<p className="empty-state">No academic years yet. Add the current school year to enable student registration.</p>}</section>
    <section className="dashboard-panel"><h2>Add academic year</h2><form action={createAcademicYear} className="student-form"><label>Year name<input name="name" required minLength={4} maxLength={40} placeholder="2026–2027"/></label><label>Start date<input type="date" name="starts_on" required/></label><label>End date<input type="date" name="ends_on" required/></label><label className="checkbox-label"><input name="active" type="checkbox"/> Set as the active year</label><button className="button button-gold">Save academic year</button></form></section></div>
    <p><Link className="text-link" href="/portal/admin/classes">Manage classes ↗</Link></p>
  </PortalFrame>;
}
