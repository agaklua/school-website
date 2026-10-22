import { updatePassword } from "../login/actions";
import Link from "next/link";

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="portal-page"><div className="portal-card"><span className="eyebrow">ACCOUNT SECURITY</span><h1>Set a new password.</h1><p>Choose a strong password for your school account.</p>{error && <p role="alert" className="form-error">{error === "expired" ? "Your reset link has expired. Request a new one." : error === "password" ? "Use at least 12 characters, including uppercase, lowercase, and a number." : "We couldn’t update your password. Try again or request a new reset link."}</p>}<form action={updatePassword} className="login-form"><label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} required/></label><button className="button button-gold" type="submit">Update password</button></form><p className="login-help"><Link href="/login">Back to sign in</Link></p></div></main>;
}
