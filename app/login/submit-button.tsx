"use client";
import { useFormStatus } from "react-dom";
export function LoginButton(){const {pending}=useFormStatus();return <button className="button button-red" type="submit" disabled={pending}>{pending?<><span className="spinner" aria-hidden="true"/> Signing in…</>:<>Sign in <span>↗</span></>}</button>}
