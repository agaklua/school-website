import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import { PortalFrame } from "../portal-frame";
import type { SchoolRole } from "../../../lib/roles";
import { schoolToday } from "../../../lib/school-time";

const modules = [
  ["Student Management", "/portal/admin/students"], ["Teacher Management", "/portal/admin/teachers"], ["Parent and Guardian Management", "/portal/admin/guardians"],
  ["Class Management", "/portal/admin/classes"], ["Subject Management", "/portal/admin/subjects"], ["Academic Years", "/portal/admin/academic-years"], ["School Terms", "/portal/admin/terms"],
  ["Attendance", "/portal/admin/attendance"], ["Examinations", "/portal/admin/examinations"], ["Results", "/portal/admin/results"], ["Report Cards", "/portal/admin/report-cards"],
  ["Fees and Payments", "/portal/admin/finance"], ["Boarding Management", "/portal/admin/boarding"], ["Admissions", "/portal/admin/admissions"],
  ["Announcements", "/portal/admin/announcements"], ["School Calendar", "/portal/admin/calendar"], ["Reports", "/portal/admin/reports"], ["User Accounts", "/portal/admin/users"], ["School Settings", "/portal/admin/settings"], ["Audit Logs", "/portal/admin/audit"],
] as const;
const levels = [["baby_class","Baby class"],["kindergarten","Kindergarten"],["primary","Primary"],["secondary","Secondary"]] as const;
const number = (value: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value);
const money = (value: number, currency = "SSP") => `${currency} ${new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value)}`;

export default async function AdminPortal() {
  const db = await createClient(); if (!db) redirect("/login?error=setup");
  const { data: { user } } = await db.auth.getUser(); if (!user) redirect("/login");
  const { data: p } = await db.from("profiles").select("display_name,role,active").eq("id", user.id).maybeSingle();
  if (!p?.active) redirect("/login?error=inactive");
  if (!(["school_admin","super_admin"] as SchoolRole[]).includes(p.role as SchoolRole)) redirect("/portal");
  const [students, teachers, classes, pending, attendance, invoices, payments, beds, boardingAllocations, announcements, events, activity, levelResults] = await Promise.all([
    db.from("students").select("id", { count: "exact", head: true }).eq("enrollment_status", "enrolled"),
    db.from("teacher_profiles").select("id", { count: "exact", head: true }).eq("employment_status", "active"),
    db.from("school_classes").select("id", { count: "exact", head: true }).eq("active", true),
    db.from("admission_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("attendance_records").select("status").eq("school_day", schoolToday()),
    db.from("fee_invoices").select("id,amount_due,currency,status").neq("status", "void"),
    db.from("fee_payments").select("invoice_id,amount,received_at"),
    db.from("boarding_bed_inventory").select("id").eq("active", true),
    db.from("boarding_allocations").select("bed_id").eq("status","active").lte("starts_on",schoolToday()).or(`ends_on.is.null,ends_on.gte.${schoolToday()}`),
    db.from("announcements").select("id,title,published_at").eq("published", true).order("published_at", { ascending: false }).limit(5),
    db.from("school_events").select("id,title,starts_at").eq("published", true).gte("starts_at", new Date().toISOString()).order("starts_at").limit(5),
    db.from("audit_logs").select("id,action,entity_type,created_at").order("created_at", { ascending: false }).limit(6),
    Promise.all(levels.map(([level]) => db.from("students").select("id", { count: "exact", head: true }).eq("school_level", level).eq("enrollment_status", "enrolled"))),
  ]);
  const configured = !students.error && !teachers.error && !classes.error && !beds.error && !boardingAllocations.error;
  const attendanceRows = attendance.data ?? [];
  const present = attendanceRows.filter(x => x.status === "present" || x.status === "late").length;
  const invoicesRows = invoices.data ?? [];
  const paymentRows = payments.data ?? [];
  const paidByInvoice = new Map<string, number>();
  for (const payment of paymentRows) paidByInvoice.set(payment.invoice_id, (paidByInvoice.get(payment.invoice_id) ?? 0) + Number(payment.amount));
  const outstanding = invoicesRows.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.amount_due) - (paidByInvoice.get(invoice.id) ?? 0)), 0);
  const today = schoolToday();
  const todayCollection = paymentRows.filter(x => schoolToday(new Date(x.received_at)) === today).reduce((sum,x) => sum + Number(x.amount),0);
  const occupied = new Set((boardingAllocations.data ?? []).map(x=>x.bed_id)).size;
  return <PortalFrame title="School administration" name={p.display_name || "Administrator"} role={p.role === "super_admin" ? "Super Administrator" : "School Administrator"}>
    {!configured && <p className="form-error" role="status">Some management tables are not available yet. Apply migrations 004, 005, and 006 to connect live records.</p>}
    <div className="dashboard-metrics">
      <article><span>Enrolled students</span><strong>{number(students.count ?? 0)}</strong><small>Current active enrollment</small></article>
      <article><span>Teachers</span><strong>{number(teachers.count ?? 0)}</strong><small>Active teacher profiles</small></article>
      <article><span>Active classes</span><strong>{number(classes.count ?? 0)}</strong><small>Across all school levels</small></article>
      <article><span>Pending admissions</span><strong>{number(pending.count ?? 0)}</strong><small><Link href="/portal/admin/admissions">Review applications ↗</Link></small></article>
      <article><span>Attendance today</span><strong>{attendanceRows.length ? `${Math.round(100*present/attendanceRows.length)}%` : "—"}</strong><small>{number(present)} present or late / {number(attendanceRows.length)} recorded</small></article>
      <article><span>Fee collection today</span><strong>{money(todayCollection)}</strong><small>From recorded payment entries</small></article>
      <article><span>Outstanding balances</span><strong>{money(outstanding)}</strong><small>Invoices less recorded payments</small></article>
      <article><span>Boarding occupancy</span><strong>{number(occupied)} / {number((beds.data ?? []).length)}</strong><small>Occupied active beds today</small></article>
    </div>
    <section className="dashboard-columns">
      <article className="dashboard-panel"><h2>Students by school level</h2>{levels.map(([key,label],i)=><div className="dashboard-row" key={key}><span>{label}</span><b>{number(levelResults[i].count ?? 0)}</b></div>)}</article>
      <article className="dashboard-panel"><h2>Latest announcements</h2>{announcements.data?.length ? announcements.data.map(item=><div className="dashboard-row" key={item.id}><span>{item.title}</span><small>{new Date(item.published_at).toLocaleDateString()}</small></div>) : <p className="empty-state">No published announcements yet.</p>}</article>
      <article className="dashboard-panel"><h2>Upcoming events</h2>{events.data?.length ? events.data.map(item=><div className="dashboard-row" key={item.id}><span>{item.title}</span><small>{new Date(item.starts_at).toLocaleDateString()}</small></div>) : <p className="empty-state">No upcoming published events.</p>}</article>
      <article className="dashboard-panel"><h2>Recent administrative activity</h2>{activity.data?.length ? activity.data.map(item=><div className="dashboard-row" key={item.id}><span>{item.action.replaceAll("."," ")} · {item.entity_type}</span><small>{new Date(item.created_at).toLocaleString()}</small></div>) : <p className="empty-state">No administrative activity recorded.</p>}</article>
    </section>
    <section className="module-section"><div className="section-head"><h2>School management</h2><p>Open an authorized workspace</p></div><div className="module-grid">{modules.map(([name,href])=><Link key={name} href={href}>{name}<span>↗</span></Link>)}</div></section>
  </PortalFrame>;
}
