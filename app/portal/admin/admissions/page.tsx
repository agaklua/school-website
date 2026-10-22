import type {Metadata} from "next";
import {requireAdmissionsStaff} from "../../../../lib/supabase/admin";
import {PortalFrame} from "../../portal-frame";
import {ApplicationList} from "./application-list";
export const metadata:Metadata={title:"Admissions review"};
export default async function AdmissionsReview({searchParams}:{searchParams:Promise<{saved?:string;error?:string}>}){
 const {supabase,profile}=await requireAdmissionsStaff();const[{data,error},query]=await Promise.all([supabase.from("admission_applications").select("id,reference_code,application_type,student_name,date_of_birth,school_level,parent_name,parent_relationship,parent_email,parent_phone,message,document_path,status,admin_notes,created_at").order("created_at",{ascending:false}).limit(200),searchParams]);
 const message=query.error==="save"?"Could not save your review. Check the admissions migration and try again.":query.error==="file"?"The private file could not be opened or is unavailable.":query.error?"Check the status and notes, then try again.":null;
 return <PortalFrame title="Admissions review" name={profile.display_name||"Admissions staff"} role={profile.role==="admissions_officer"?"Admissions Officer":"Administrator"}><p className="portal-welcome">Review applications, contact families directly and update each decision. Marking an application accepted does not register or enrol the learner.</p>{query.saved&&<p className="form-success" role="status">Application review saved.</p>}{message&&<p className="form-error" role="alert">{message}</p>}{error&&<p className="form-error" role="alert">Applications could not be loaded. Apply the admissions migration and refresh.</p>}<ApplicationList items={data||[]}/></PortalFrame>;
}
