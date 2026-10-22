import type { Metadata } from "next";
import { InfoPage } from "../content";
export const metadata:Metadata={title:"School history"};
export default function History(){return <InfoPage label="OUR STORY" title="A growing school community." text="The story of St. Lawrence Academy."><h2>Established in 2020</h2><p>The school entrance sign identifies St. Lawrence Academy as established in 2020. The school’s fuller history—including its founding story and milestones—will be added when confirmed by the school.</p><p className="note">Families and alumni are welcome to share verified photographs and memories with the school office.</p></InfoPage>}
