import type { Metadata } from "next";
import { PageIntro } from "../content";
import { SchoolLinks } from "../school-links";
export const metadata:Metadata={title:"Explore our school"};
export default function School(){return <main><PageIntro label="ST. LAWRENCE ACADEMY" title="Explore our school." text="Find information about learning, school life and the community at St. Lawrence Academy."/><section className="section"><div className="wrap"><SchoolLinks/></div></section></main>}
