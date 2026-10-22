import type { Metadata } from "next";
import "./styles.css";
import { Footer, Header } from "./site";
import { getSchoolIdentity } from "../lib/school";
import type { CSSProperties } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const school = await getSchoolIdentity();
  return { title: { default: `${school.school_name} | ${school.country}`, template: `%s | ${school.school_name}` }, description: `${school.school_name} — ${school.motto}. Baby class, kindergarten, primary and secondary education in ${school.country}.` };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const school = await getSchoolIdentity();
  const theme = { "--navy": school.primary_color, "--red": school.accent_color } as CSSProperties;
  return <html lang="en"><body style={theme}><Header school={school} />{children}<Footer school={school} /></body></html>;
}
