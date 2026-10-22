"use server";
import { createHmac, createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceClient } from "../../../lib/supabase/service";

const hashCode=(code:string)=>createHash("sha256").update(code).digest("hex");
const fail=(reason:string):never=>redirect(`/admissions/apply?error=${reason}`);
export async function submitAdmission(form:FormData){
  const honeypot=String(form.get("website")||"");if(honeypot)fail("invalid");
  const student_name=String(form.get("student_name")||"").trim();
  const date_of_birth=String(form.get("date_of_birth")||"").trim();
  const school_level=String(form.get("school_level")||"");
  const parent_name=String(form.get("parent_name")||"").trim();
  const parent_relationship=String(form.get("parent_relationship")||"").trim();
  const parent_email=String(form.get("parent_email")||"").trim().toLowerCase();
  const parent_phone=String(form.get("parent_phone")||"").trim();
  const message=String(form.get("message")||"").trim();
  const application_type=String(form.get("application_type")||"");
  const consent=form.get("consent")==="on";
  const dob=new Date(`${date_of_birth}T00:00:00.000Z`);const validDate=Number.isFinite(dob.getTime())&&dob.toISOString().slice(0,10)===date_of_birth;
  const todayParts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Juba",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const today=`${todayParts.find(x=>x.type==="year")?.value}-${todayParts.find(x=>x.type==="month")?.value}-${todayParts.find(x=>x.type==="day")?.value}`;
  if(student_name.length<2||student_name.length>120||!validDate||date_of_birth>today)fail("student");
  if(!["baby_class","kindergarten","primary","secondary"].includes(school_level)||parent_name.length<2||parent_name.length>120||parent_relationship.length<2||parent_relationship.length>40)fail("guardian");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parent_email)||parent_email.length>254||!/^[+0-9()\-\s]{6,40}$/.test(parent_phone))fail("contact");
  if(message.length>1200||!["enquiry","application"].includes(application_type)||!consent)fail("form");
  const uploaded=form.get("document");let file:File|undefined;
  if(uploaded&&typeof uploaded!=="string"&&uploaded.size){
    file=uploaded;
    if(file.size>5*1024*1024)fail("file_size");
    const bytes=Buffer.from(await file.slice(0,8).arrayBuffer());
    const isPdf=bytes.subarray(0,5).toString()==="%PDF-";
    const isJpeg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
    const isPng=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    if(!isPdf&&!isJpeg&&!isPng)fail("file_type");
  }
  const supabase=createServiceClient();if(!supabase)return redirect("/admissions/apply?error=setup");
  const headerStore=await headers();const ip=headerStore.get("x-real-ip")||headerStore.get("x-forwarded-for")?.split(",").at(-1)?.trim()||"unknown";
  const ipHash=createHmac("sha256",process.env.SUPABASE_SERVICE_ROLE_KEY!).update(ip).digest("hex");
  const {data:allowed,error:rateError}=await supabase.rpc("consume_admission_rate_limit",{p_ip_hash:ipHash});
  if(rateError)return fail("setup");if(allowed!==true)return fail("rate");
  const reference_code=`SLA-${randomUUID().replaceAll("-","").slice(0,16).toUpperCase()}`;
  const accessCode=randomBytes(24).toString("base64url");const access_code_hash=hashCode(accessCode);
  const {error}=await supabase.from("admission_applications").insert({reference_code,access_code_hash,application_type,student_name,date_of_birth,school_level,parent_name,parent_relationship,parent_email,parent_phone,message});
  if(error)fail("save");
  let uploadWarning=false;
  if(file){
    const first=Buffer.from(await file.slice(0,8).arrayBuffer());
    const isPdf=first.subarray(0,5).toString()==="%PDF-";
    const isJpeg=first[0]===0xff&&first[1]===0xd8&&first[2]===0xff;
    const ext=isPdf?"pdf":isJpeg?"jpg":"png";
    const contentType=isPdf?"application/pdf":isJpeg?"image/jpeg":"image/png";
    const path=`incoming/${reference_code}/${randomUUID()}.${ext}`;
    const {error:uploadError}=await supabase.storage.from("admission-documents").upload(path,Buffer.from(await file.arrayBuffer()),{contentType,upsert:false,cacheControl:"0"});
    if(uploadError){uploadWarning=true;}else{
      const {error:attachError}=await supabase.from("admission_applications").update({document_path:path}).eq("reference_code",reference_code).eq("access_code_hash",access_code_hash);
      if(attachError)uploadWarning=true;
    }
  }
  const cookieStore=await cookies();const cookieOptions={httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict" as const,path:"/admissions/confirmation",maxAge:900};
  cookieStore.set("sla_admission_reference",reference_code,cookieOptions);cookieStore.set("sla_admission_access",accessCode,cookieOptions);
  if(uploadWarning)cookieStore.set("sla_admission_upload_warning","1",cookieOptions);
  redirect("/admissions/confirmation");
}
