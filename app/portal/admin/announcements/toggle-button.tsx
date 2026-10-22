"use client";
import { useFormStatus } from "react-dom";
export function ToggleButton({published}:{published:boolean}){const {pending}=useFormStatus();return <button disabled={pending} className="small-action">{pending?"Saving…":published?"Unpublish":"Publish"}</button>}
