import type { Metadata } from "next";
import Image from "next/image";
import { InfoPage } from "../content";
export const metadata:Metadata={title:"Gallery"};
const photos=[["campus.jpg","School buildings and courtyard"],["campus-courtyard.jpg","Campus buildings"],["school-team.jpg","Members of the school community"],["teachers-event.jpg","St. Lawrence Academy teachers at a school event"],["students-lab.jpg","Students taking part in science practical work"],["students-purple-uniform.jpg","Students gathered in their purple school uniforms"],["uniform.jpg","Student in school sports uniform"],["student.jpg","Student in school uniform"]];
export default function Gallery(){return <InfoPage label="LIFE AT SLA" title="A look around our school." text="Photographs shared by St. Lawrence Academy."><div className="gallery-grid">{photos.map(([src,alt])=><figure key={src}><Image src={`/images/${src}`} alt={alt} width={650} height={460}/><figcaption>{alt}</figcaption></figure>)}</div></InfoPage>}
