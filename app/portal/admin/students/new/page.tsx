import Link from "next/link";
import { requirePermission } from "../../../../../lib/supabase/admin";
import { PortalFrame } from "../../../portal-frame";
import { registerStudent } from "../actions";

const errors: Record<string,string> = { invalid:"Review the required fields. Dates, school level, guardian contact and admission number must be valid.", photo:"Choose a JPG, PNG or WebP image under 5 MB.", duplicate:"That admission number is already in use.", save:"The registration could not be saved. Confirm the selected academic year and class, then try again." };
export default async function NewStudent({ searchParams }: { searchParams: Promise<{ error?:string }> }) {
  const { supabase, profile } = await requirePermission("students.manage");
  const [{ data: years }, { data: classes }, { error }] = await Promise.all([
    supabase.from("academic_years").select("id,name,active").order("starts_on", { ascending:false }),
    supabase.from("school_classes").select("id,name,school_level").eq("active",true).order("school_level").order("name"),
    searchParams,
  ]);
  return <PortalFrame title="Register student" name={profile.display_name || "Administrator"} role="Administrator"><div className="page-title-row"><div><Link className="text-link" href="/portal/admin/students">← Student records</Link><p>Required student, enrollment and primary guardian details.</p></div></div>
    {error && <p role="alert" className="form-error">{errors[error] ?? "Registration failed. Please check the information and retry."}</p>}
    {!years?.length && <p role="alert" className="form-error">Add an academic year before registering students.</p>}
    <form action={registerStudent} encType="multipart/form-data" className="student-form">
      <fieldset><legend>Student profile</legend><div className="form-grid">
        <label>Admission number<input name="admission_number" required minLength={3} maxLength={32} pattern="[A-Za-z0-9/-]+" placeholder="SLA-2026-001"/></label>
        <label>Full name<input name="full_name" required minLength={2} maxLength={160} autoComplete="name"/></label>
        <label>Date of birth<input name="date_of_birth" type="date" required max={new Date().toISOString().slice(0,10)}/></label>
        <label>School level<select name="school_level" required defaultValue=""><option value="" disabled>Select level</option><option value="baby_class">Baby class</option><option value="kindergarten">Kindergarten</option><option value="primary">Primary</option><option value="secondary">Secondary</option></select></label>
        <label>Class<select name="class_id" defaultValue=""><option value="">Not assigned yet</option>{classes?.map(c=><option value={c.id} key={c.id}>{c.name} · {c.school_level.replaceAll("_"," ")}</option>)}</select></label>
        <label>Academic year<select name="academic_year_id" required defaultValue={years?.find(y=>y.active)?.id ?? years?.[0]?.id ?? ""}>{years?.map(y=><option value={y.id} key={y.id}>{y.name}{y.active?" · current":""}</option>)}</select></label>
        <label>Enrollment status<select name="enrollment_status" defaultValue="enrolled"><option value="enrolled">Enrolled</option><option value="pending">Pending</option></select></label>
        <label>Admission date<input name="admission_date" type="date" required defaultValue={new Date().toISOString().slice(0,10)}/></label>
        <label className="full">Student photograph (optional)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"/><small>Private school storage · JPG, PNG or WebP · maximum 5 MB</small></label>
      </div></fieldset>
      <fieldset><legend>Primary parent or guardian</legend><div className="form-grid">
        <label>Guardian full name<input name="guardian_name" required minLength={2} maxLength={160}/></label>
        <label>Relationship to student<input name="guardian_relationship" required maxLength={40} placeholder="Parent, aunt, guardian"/></label>
        <label>Email address<input name="guardian_email" type="email" autoComplete="email"/></label>
        <label>Telephone<input name="guardian_phone" type="tel" autoComplete="tel" required minLength={6} maxLength={40}/></label>
      </div></fieldset>
      <div className="form-actions"><button className="button button-gold" type="submit" disabled={!years?.length}>Save student record</button><Link href="/portal/admin/students">Cancel</Link></div>
    </form>
  </PortalFrame>;
}
