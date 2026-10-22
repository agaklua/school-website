"use server";
import {createHash,createHmac} from "node:crypto";
import {headers} from "next/headers";
import {createServiceClient} from "../../lib/supabase/service";
export type StatusState={error?:string;result?:{reference:string;status:string;submitted_at:string}};
export async function lookupAdmissionStatus(_previous:StatusState,form:FormData):Promise<StatusState>{
  const reference=String(form.get("reference_code")||"").trim().toUpperCase();const code=String(form.get("access_code")||"").trim();
  if(!/^SLA-[A-F0-9]{16}$/.test(reference)||!/^[A-Za-z0-9_-]{32}$/.test(code))return{error:"Enter the reference and access code exactly as provided."};
  const db=createServiceClient();if(!db)return{error:"Status checking is not connected yet. Please contact the school office."};
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!secret)return{error:"Status checking is not connected yet. Please contact the school office."};
  const requestHeaders=await headers();const ip=requestHeaders.get("x-real-ip")||requestHeaders.get("x-forwarded-for")?.split(",").at(-1)?.trim()||"unknown";
  const ipHash=createHmac("sha256",secret).update(ip).digest("hex");
  const {data:allowed,error:rateError}=await db.rpc("consume_admission_rate_limit",{p_ip_hash:ipHash});
  if(rateError||allowed!==true)return{error:rateError?"Status checking is temporarily unavailable. Please try again later.":"Too many status checks. Please wait 15 minutes and try again."};
  const access_code_hash=createHash("sha256").update(code).digest("hex");
  const {data,error}=await db.rpc("check_admission_status",{p_reference_code:reference,p_access_code_hash:access_code_hash});
  if(error)return{error:"We could not check the status right now. Please try again later."};
  const result=Array.isArray(data)?data[0]:data;
  if(!result)return{error:"No application matched both details. Check them and try again."};
  return{result:{reference:result.reference_code,status:result.status,submitted_at:result.submitted_at}};
}
