import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../content";
export const metadata:Metadata={title:"Admission requirements"};
export default function Requirements(){return <InfoPage label="ADMISSIONS" title="What you’ll need." text="Admission requirements can vary by school level and available places."><h2>Confirm the current requirements with the school</h2><p>Please contact the admissions office before preparing documents. The school will confirm age guidance, previous school records and any supporting documents required for your chosen level.</p><p>Use the application form to share your family’s interest; submitting it does not confirm admission or create an enrolled student record.</p><Link className="button button-red" href="/admissions/apply">Start an enquiry or application ↗</Link></InfoPage>}
