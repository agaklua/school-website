import type { Metadata } from "next";
import { requireSchoolAdmin } from "../../../../lib/supabase/admin";
import { PortalFrame } from "../../portal-frame";
import { AnnouncementForm } from "./announcement-form";
import { AnnouncementList } from "./announcement-list";
export const metadata:Metadata={title:"School announcements"};
export default async function Announcements({searchParams}:{searchParams:Promise<{saved?:string;error?:string}>}){
  const {supabase,profile}=await requireSchoolAdmin();const [{data},query]=await Promise.all([supabase.from("announcements").select("id,title,summary,category,published,published_at").order("created_at",{ascending:false}).limit(100),searchParams]);
  const saved:Record<string,string>={published:"Announcement is live on the public website.",draft:"Draft saved. It is not visible to visitors.",unpublished:"Announcement is no longer visible to visitors."};
  return <PortalFrame title="News & announcements" name={profile.display_name||"Administrator"} role="Administrator"><p className="portal-welcome">Write updates for the public school website. Drafts remain private until you publish them.</p>{query.saved&&<p className="form-success" role="status">{saved[query.saved]||"Changes saved."}</p>}{query.error&&<p className="form-error" role="alert">{query.error==="invalid"?"Check the headline, summary and category lengths.":"Could not save the announcement. Check the migration and try again."}</p>}<div className="announcement-columns"><div className="settings-panel"><h2>New announcement</h2><AnnouncementForm/></div><div className="settings-panel"><h2>Recent announcements</h2><AnnouncementList items={data||[]}/></div></div></PortalFrame>;
}
