"use server";
import { redirect } from "next/navigation";
import { requireRole } from "../../lib/supabase/admin";

function text(form: FormData, key: string, max = 160) { return String(form.get(key) ?? "").trim().slice(0, max); }
function fail(code: string): never { redirect(`/portal/admin/boarding?error=${code}`); }
export async function createBoardingRecord(form: FormData) {
 const { supabase, user } = await requireRole(["super_admin", "school_admin"]);
 const kind = text(form,"kind",20);
 let error: {message:string}|null=null;
 if(kind==="building") ({error}=await supabase.from("boarding_buildings").insert({name:text(form,"name"),description:text(form,"description",500)||null}));
 else if(kind==="dormitory") ({error}=await supabase.from("boarding_dormitories").insert({building_id:Number(text(form,"building_id")),name:text(form,"name"),eligible_gender:text(form,"eligible_gender",10)||null}));
 else if(kind==="room") ({error}=await supabase.from("boarding_rooms").insert({dormitory_id:Number(text(form,"dormitory_id")),room_label:text(form,"room_label",40),capacity:Number(text(form,"capacity"))}));
 else if(kind==="bed") ({error}=await supabase.from("boarding_bed_inventory").insert({room_id:Number(text(form,"room_id")),bed_label:text(form,"bed_label",40)}));
 else if(kind==="assignment") {
  const scope=text(form,"scope",12); const data:any={profile_id:text(form,"profile_id"),starts_on:text(form,"starts_on",10)||new Date().toISOString().slice(0,10),assigned_by:user.id};
  if(scope==="building")data.building_id=Number(text(form,"building_id")); else if(scope==="dormitory")data.dormitory_id=Number(text(form,"dormitory_id")); else data.room_id=Number(text(form,"room_id"));
  ({error}=await supabase.from("boarding_staff_assignments").insert(data));
 }
 else if(kind==="fee") ({error}=await supabase.from("boarding_fee_charges").insert({student_id:text(form,"student_id"),allocation_id:Number(text(form,"allocation_id"))||null,description:text(form,"description"),amount:Number(text(form,"amount")),currency:text(form,"currency",3).toUpperCase()||"SSP",due_on:text(form,"due_on",10)||null,created_by:user.id}));
 else if(kind==="payment") ({error}=await supabase.from("boarding_fee_payments").insert({charge_id:Number(text(form,"charge_id")),amount:Number(text(form,"amount")),receipt_number:text(form,"receipt_number",60)||null,recorded_by:user.id}));
 else if(kind==="announcement") ({error}=await supabase.from("boarding_announcements").insert({title:text(form,"title"),body:text(form,"body",5000),published:form.get("published")==="on",published_at:form.get("published")==="on"?new Date().toISOString():null,created_by:user.id}));
 else fail("invalid");
 if(error)fail("save"); redirect("/portal/admin/boarding?saved=1");
}
export async function allocateBoardingBed(form: FormData) {
 const {supabase}=await requireRole(["super_admin","school_admin"]);
 const student=text(form,"student_id",40), bed=Number(text(form,"bed_id")), start=text(form,"starts_on",10), end=text(form,"ends_on",10)||null, fee=Number(text(form,"fee"));
 if(!student||!bed||!/^\d{4}-\d\d-\d\d$/.test(start)||!Number.isFinite(fee)||fee<0|| (end&&end<start))fail("invalid");
 const {error}=await supabase.rpc("create_boarding_allocation",{p_student:student,p_bed:bed,p_starts:start,p_ends:end,p_fee:fee,p_currency:(text(form,"currency",3)||"SSP").toUpperCase(),p_notes:text(form,"notes",1000)||null});
 if(error)fail("allocation"); redirect("/portal/admin/boarding?saved=allocated");
}
export async function recordBoardingRollCall(form: FormData) {
 const {supabase}=await requireRole(["super_admin","school_admin","boarding_staff"]);
 const day=text(form,"roll_date",10),session=text(form,"session",10); let data:unknown;
 try{data=JSON.parse(text(form,"records",100000)||"[]")}catch{fail("invalid")}
 if(!/^\d{4}-\d\d-\d\d$/.test(day)||day>new Date().toISOString().slice(0,10)||!Array.isArray(data)||data.length>1000)fail("invalid");
 const {error}=await supabase.rpc("record_boarding_roll_call",{p_date:day,p_session:session,p_records:data});
 if(error)fail("rollcall"); redirect("/portal/admin/boarding?saved=rollcall");
}
export async function recordBoardingMovement(form: FormData) {
 const {supabase}=await requireRole(["super_admin","school_admin","boarding_staff"]);
 const {error}=await supabase.rpc("record_boarding_movement",{p_allocation:Number(text(form,"allocation_id")),p_movement:text(form,"movement",12),p_note:text(form,"note",300)||null});
 if(error)fail("movement"); redirect("/portal/admin/boarding?saved=movement");
}
export async function endBoardingAssignment(form:FormData){
 const {supabase}=await requireRole(["super_admin","school_admin"]); const id=Number(text(form,"assignment_id"));
 if(!Number.isSafeInteger(id)||id<1)fail("invalid");
 const {data}=await supabase.from("boarding_staff_assignments").select("starts_on").eq("id",id).maybeSingle(); if(!data)fail("invalid");
 const today=new Date().toISOString().slice(0,10); const {error}=await supabase.from("boarding_staff_assignments").update({active:false,ends_on:data.starts_on>today?data.starts_on:today}).eq("id",id);
 if(error)fail("save"); redirect("/portal/admin/boarding?saved=assignment");
}
