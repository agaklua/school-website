import type { Metadata } from "next";
import { InfoPage } from "../content";
export const metadata:Metadata={title:"Boarding facilities"};
export default function Boarding(){return <InfoPage label="SCHOOL LIFE" title="Boarding at SLA." text="Information for families considering boarding at St. Lawrence Academy."><h2>Ask us about current arrangements</h2><p>Contact the school to confirm whether boarding places are available and to learn about accommodation, supervision, meals, visiting arrangements and costs.</p><p className="note">Current boarding capacity, facilities and policies have not yet been confirmed for publication.</p></InfoPage>}
