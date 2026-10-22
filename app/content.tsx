import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export function PageIntro({ label, title, text }: { label: string; title: string; text: string }) { return <section className="page-intro"><div className="wrap"><span className="eyebrow light">{label}</span><h1>{title}</h1><p>{text}</p></div></section>; }
export function InfoPage({ label, title, text, children }: { label: string; title: string; text: string; children: React.ReactNode }) { return <main><PageIntro label={label} title={title} text={text}/><section className="section"><div className="wrap content-layout"><div className="content-body">{children}</div><aside className="side-card"><span className="eyebrow">START A CONVERSATION</span><h3>We’re here to help.</h3><p>Speak with the school office to learn more about St. Lawrence Academy.</p><Link className="button button-red" href="/contact">Contact the school <span>↗</span></Link></aside></div></section></main>; }
export const schoolDescription = "St. Lawrence Academy is a baby class, kindergarten, primary and secondary school in South Sudan. Its motto is ‘Education is the key of life.’";
