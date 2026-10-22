"use client";
import { useFormStatus } from "react-dom";
export function SaveButton() { const { pending } = useFormStatus(); return <button type="submit" className="button button-red" disabled={pending}>{pending ? <><span className="spinner" aria-hidden="true"/> Saving…</> : "Save school identity"}</button>; }
