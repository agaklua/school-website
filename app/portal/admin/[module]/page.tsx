import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission } from "../../../../lib/supabase/admin";
import { PortalFrame } from "../../portal-frame";

const modules: Record<string,{title:string;permission:string;description:string}> = {
  teachers:{title:"Teacher Management",permission:"users.manage",description:"Manage teacher accounts through the trusted school account-provisioning process."},
  guardians:{title:"Parent and Guardian Management",permission:"students.manage",description:"Guardian records are created and linked during student registration."},
  classes:{title:"Class Management",permission:"academics.manage",description:"Class records define school level, academic year and capacity."},
  subjects:{title:"Subject Management",permission:"academics.manage",description:"Maintain the subjects offered at each school level."},
  "academic-years":{title:"Academic Years",permission:"academics.manage",description:"Academic years define the active enrollment period."},
  terms:{title:"School Terms",permission:"academics.manage",description:"Manage term dates within an academic year."},
  attendance:{title:"Attendance",permission:"attendance.manage",description:"Attendance records are restricted to authorized staff."},
  examinations:{title:"Examinations",permission:"academics.manage",description:"Assessment scheduling and examination records are not connected yet."},
  results:{title:"Results",permission:"academics.manage",description:"Results are private student records and require an authorized academic workflow."},
  "report-cards":{title:"Report Cards",permission:"academics.manage",description:"Report cards will be generated from verified assessment and student records."},
  finance:{title:"Fees and Payments",permission:"finance.manage",description:"Invoices and payment records are private financial information."},
  boarding:{title:"Boarding Management",permission:"boarding.manage",description:"Manage active bed occupancy and student boarding allocations."},
  calendar:{title:"School Calendar",permission:"academics.manage",description:"Published dates appear on the public school calendar."},
  reports:{title:"Reports",permission:"reports.view",description:"School reports use database records and respect your assigned permissions."},
  users:{title:"User Accounts",permission:"users.manage",description:"Account roles and activation are provisioned by trusted administrators, never by the account holder."},
  audit:{title:"Audit Logs",permission:"audit.view",description:"Review recent administrative changes recorded by the school system."},
};
export default async function AdminModule({params}:{params:Promise<{module:string}>}) {
  const {module}=await params; const item=modules[module]; if(!item) notFound();
  const {profile}=await requirePermission(item.permission);
  return <PortalFrame title={item.title} name={profile.display_name||"School staff"} role={profile.role.replaceAll("_"," ")}><div className="portal-empty"><h2>{item.title}</h2><p>{item.description}</p><p>Database permissions are enforced by Supabase Row Level Security. This module workspace is ready for the school’s records and operational workflow.</p><Link className="text-link" href="/portal/admin">← Return to administration dashboard</Link></div></PortalFrame>;
}
