"use client";
import {useFormStatus} from "react-dom";
export function ReviewButton(){const{pending}=useFormStatus();return <button className="button button-red" disabled={pending}>{pending?<><span className="spinner" aria-hidden="true"/> Saving…</>:"Save review"}</button>}
