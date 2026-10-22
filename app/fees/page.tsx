import type { Metadata } from "next";
import { InfoPage } from "../content";
export const metadata:Metadata={title:"School fees"};
export default function Fees(){return <InfoPage label="FAMILY INFORMATION" title="School fees." text="Fees and payment arrangements are confirmed directly with the school."><div className="empty-content"><h2>Request the current fee schedule</h2><p>Fees, payment dates and any additional costs have not been provided for publication. Contact the school office for the current information for your child’s level.</p></div></InfoPage>}
