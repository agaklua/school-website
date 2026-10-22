"use client";
import { saveIdentity } from "./actions";
import { SaveButton } from "./submit-button";
import type { SchoolIdentity } from "../../../../lib/school";
export function IdentityForm({ school }: { school: SchoolIdentity }) {
  return <form action={saveIdentity} className="identity-form" onSubmit={(event)=>{ if(!window.confirm("Save these public school identity changes? They will update the website for everyone.")) event.preventDefault(); }}>
    <fieldset><legend>School identity</legend><div className="settings-fields"><label>School name<input name="school_name" required maxLength={100} defaultValue={school.school_name}/></label><label>Short name / acronym<input name="acronym" required maxLength={16} defaultValue={school.acronym}/></label><label className="full">School motto<input name="motto" required maxLength={160} defaultValue={school.motto}/></label><label>Country<input name="country" required maxLength={80} defaultValue={school.country}/></label><label>Address<input name="address" maxLength={200} defaultValue={school.address} placeholder="Optional public address"/></label></div></fieldset>
    <fieldset><legend>Public contact details</legend><div className="settings-fields"><label>Telephone<input name="phone" type="tel" maxLength={40} defaultValue={school.phone} placeholder="Add verified school number"/></label><label>Email<input name="email" type="email" maxLength={254} defaultValue={school.email} placeholder="office@example.org"/></label></div></fieldset>
    <fieldset><legend>Branding</legend><div className="settings-fields"><label className="full">Logo image URL or local path<input name="logo_url" defaultValue={school.logo_url} placeholder="/images/crest.jpg"/><small>Use a local path such as /images/crest.jpg or a secure https URL.</small></label><label>Primary colour<input name="primary_color" type="color" required defaultValue={school.primary_color}/></label><label>Accent colour<input name="accent_color" type="color" required defaultValue={school.accent_color}/></label></div></fieldset>
    <SaveButton/>
  </form>;
}
