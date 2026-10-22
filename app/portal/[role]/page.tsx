import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import { roleDetails, type SchoolRole } from "../../../lib/roles";
import { PortalFrame } from "../portal-frame";

const copy: Partial<Record<SchoolRole,{title:string;summary:string;links:[string,string][]}>> = {
  parent:{title:"Parent and guardian dashboard",summary:"This secure space is for notices and records linked to your family account.",links:[["My children's boarding","/portal/parent/boarding"],["School announcements","/news"],["School calendar","/calendar"],["Contact the school","/contact"]]},
  bursar:{title:"Bursar dashboard",summary:"Finance workspace for fee invoices, receipts and outstanding balances.",links:[["Fees and payments","/portal/admin/finance"],["Finance reports","/portal/admin/reports"]]},
  boarding_staff:{title:"Boarding staff dashboard",summary:"Boarding workspace for occupancy, allocations and authorized student support.",links:[["Boarding management","/portal/boarding"]]},
  admissions_officer:{title:"Admissions officer dashboard",summary:"Review submitted applications and manage authorized applicant follow-up.",links:[["Application review","/portal/admin/admissions"]]},
};
export default async function RolePortal({params}:{params:Promise<{role:string}>}) {
  const {role}=await params; const expected=role;
  const match=(Object.entries(roleDetails) as [SchoolRole,{label:string;destination:string}][]).find(([,v])=>v.destination===`/portal/${expected}`);
  if(!match) notFound();
  const [userRole,detail]=match; const db=await createClient(); if(!db) redirect("/login?error=setup");
  const {data:{user}}=await db.auth.getUser(); if(!user) redirect("/login");
  const {data:p}=await db.from("profiles").select("display_name,role,active").eq("id",user.id).single();
  if(!p?.active) redirect("/login?error=credentials");
  if(p.role!==userRole) redirect(roleDetails[p.role as SchoolRole]?.destination||"/login");
  const page=copy[userRole];
  return <PortalFrame title={page?.title||detail.label+" dashboard"} name={p.display_name||detail.label} role={detail.label}><div className="role-dashboard"><div className="portal-empty"><h2>{page?.title||"Your school workspace"}</h2><p>{page?.summary||"Your timetable, assignments and class records appear in this role-specific workspace."}</p><span className="status-pill">Account active</span></div><div className="module-grid">{page?.links.map(([label,href])=><Link href={href} key={href}>{label}<span>↗</span></Link>)}</div></div></PortalFrame>;
}
