"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { SchoolIdentity } from "../lib/school";

const nav = [["Home", "/"], ["School", "/school"], ["Learning", "/learning"], ["News", "/news"], ["Admissions", "/admissions"], ["Contact", "/contact"]];
const footerLinks = [["School history","/history"],["Leadership","/leadership"],["Baby class","/baby-class"],["Kindergarten","/kindergarten"],["Primary","/primary"],["Secondary","/secondary"],["Boarding","/boarding"],["Requirements","/admission-requirements"],["School fees","/fees"],["Calendar","/calendar"],["Gallery","/gallery"],["FAQs","/faq"],["Privacy","/privacy"],["Terms","/terms"]];
export function Header({ school }: { school: SchoolIdentity }) {
  const [open, setOpen] = useState(false);
  return <header className="header"><div className="topline"><div className="wrap top-inner"><span>{school.country}{school.address ? ` · ${school.address}` : ""}</span><span>{school.motto}</span></div></div><div className="wrap navrow">
    <Link href="/" className="brand" aria-label={`${school.school_name} home`}><Image src={school.logo_url || "/images/crest.jpg"} width={58} height={58} alt={`${school.school_name} logo`} unoptimized/><span><b>{school.school_name.toUpperCase()}</b><small>{school.acronym}</small></span></Link>
    <button className="menu-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="site-navigation" aria-label={open ? "Close navigation menu" : "Open navigation menu"}>{open ? "Close" : "Menu"}</button>
    <nav id="site-navigation" className={open ? "nav open" : "nav"} aria-label="Main navigation">{nav.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}<Link href="/login" onClick={() => setOpen(false)}>Portal login</Link><Link className="nav-cta" href="/admissions/apply">Apply now <span>↗</span></Link></nav>
  </div></header>;
}
export function Footer({ school }: { school: SchoolIdentity }) { return <footer className="footer"><div className="wrap footer-grid"><div><Link href="/" className="brand foot-brand"><Image src={school.logo_url || "/images/crest.jpg"} width={52} height={52} alt="" unoptimized/><span><b>{school.school_name.toUpperCase()}</b><small>{school.acronym}</small></span></Link><p>{school.motto}.</p></div><div><h3>Explore</h3>{nav.slice(1).map(([l,h])=><Link key={h} href={h}>{l}</Link>)}</div><div><h3>School information</h3><div className="footer-resources">{footerLinks.map(([l,h])=><Link key={h} href={h}>{l}</Link>)}</div></div><div><h3>Get in touch</h3><p>{school.address || school.country}</p>{school.phone && <p><a href={`tel:${school.phone}`}>{school.phone}</a></p>}{school.email && <p><a href={`mailto:${school.email}`}>{school.email}</a></p>}{!school.phone && !school.email && <p>School contact details will be posted here when confirmed.</p>}<Link href="/contact" className="text-link">Contact the school ↗</Link></div></div><div className="wrap copyright"><span>© {new Date().getFullYear()} {school.school_name}</span><span>{school.motto}</span></div></footer>; }
