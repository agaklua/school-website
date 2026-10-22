import "server-only";
import { createClient } from "./supabase/server";
export type SchoolEvent={id:number;title:string;summary:string;starts_at:string;ends_at:string|null;location:string};
export async function getUpcomingEvents(limit=3):Promise<SchoolEvent[]>{const db=await createClient();if(!db)return[];const {data}=await db.from("school_events").select("id,title,summary,starts_at,ends_at,location").eq("published",true).gte("starts_at",new Date().toISOString()).order("starts_at",{ascending:true}).limit(limit);return(data||[])as SchoolEvent[];}
