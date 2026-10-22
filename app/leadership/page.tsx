import type { Metadata } from "next";
import { InfoPage } from "../content";
import Image from "next/image";
export const metadata:Metadata={title:"School leadership"};
export default function Leadership(){return <InfoPage label="OUR PEOPLE" title="School leadership." text="Meet the team guiding learning and school life at St. Lawrence Academy."><figure className="leadership-photo"><Image src="/images/teachers-event.jpg" alt="St. Lawrence Academy teachers gathered at a school event" width={1440} height={960}/><figcaption>Teachers and staff of St. Lawrence Academy</figcaption></figure><div className="empty-content"><h2>Leadership profiles are being prepared.</h2><p>Verified names, roles and biographies will be published here when approved by the school.</p></div></InfoPage>}
