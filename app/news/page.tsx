import type { Metadata } from "next";
import { PageIntro } from "../content";
import { getAllPublicAnnouncements } from "../../lib/news";
import { NewsBrowser } from "./news-browser";
export const metadata:Metadata={title:"News and announcements"};
export default async function News(){const items=await getAllPublicAnnouncements();return <main><PageIntro label="FROM THE SCHOOL" title="News & announcements." text="Updates and information from the St. Lawrence Academy community."/><section className="section news"><div className="wrap"><NewsBrowser items={items}/></div></section></main>}
