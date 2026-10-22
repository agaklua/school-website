# St. Lawrence Academy website

Responsive public website and Supabase portal foundation for St. Lawrence Academy (SLA), baby class, kindergarten, primary and secondary school in South Sudan.

## Run locally

Prerequisites: Node.js 20.9 or newer and npm.

```sh
cd C:\Users\luala\Documents\Codex\2026-10-22\s\work\st-lawrence-academy
npm install
npm run dev
```

Open the local address printed by Next.js. To create a production build, run `npm run build` and then `npm run start`.

## Current implementation

- Next.js App Router, TypeScript and responsive CSS (using system font fallbacks so the site does not depend on a remote font service).
- Public pages: Home, About, School History, School Leadership, Baby Class, Kindergarten, Primary School, Secondary School, Boarding Facilities, Admissions, Admission Requirements, School Fees, News, Calendar, Gallery, FAQs, Contact, Privacy Policy, Terms of Use and Login.
- Public news feed and campus/facilities photography section.
- Administrator-editable school name, short name, motto, location, phone, email, logo and brand colours; administrator announcement drafting/publishing with search, sorting and pagination.
- Admissions enquiry/application form, private random reference and access-code status check, server-side field and upload validation, optional private supporting document, admissions staff review and decision notes.
- Upcoming school events section with an empty state until dates are entered.
- Supplied crest and six school photographs in `public/images/`.
- Fees, street address, and admission rules are not invented; the school can publish verified details through the administration tools.

The portal uses separate Supabase SSR browser/server clients and a server-only `@supabase/supabase-js` service client for validated public admissions operations. Middleware refreshes sessions and calls `getUser`; protected pages and actions repeat server-side active-account, role, permission, and employment checks. Migrations 4–7 add RLS-protected school records, scoped teaching and boarding responsibilities, narrow sequence grants, private bucket enforcement, an RLS coverage assertion, abuse limiting for application intake and status lookup, and audit records for sensitive writes. Student registration, guardian relationships, academic-year/class/subject setup, teacher profiles, assignments, attendance, and boarding management are implemented. Boarding has separate facilities, date-bounded allocations, fees/payments, roll-call, check-in/out records, announcements, and staff assignments. Database triggers prevent overlapping allocations, room over-capacity, and fee overpayment; RLS scopes boarding staff to assigned areas and parents to linked children's records. Other management destinations remain staged workspaces.

## Portal routes

- Sign-in: `/login` (all roles use the same login; access is determined from the database profile role).
- Student: `/portal/student`
- Teacher: `/portal/teacher`
- Teacher attendance: `/portal/teacher/attendance` (limited to currently assigned classes)
- School administrator: `/portal/admin`
- Parent/guardian, bursar, boarding staff: `/portal/parent`, `/portal/bursar`, `/portal/boarding`
- Parent boarding details for linked children: `/portal/parent/boarding`
- Boarding management for administrators and assigned boarding staff: `/portal/admin/boarding` and `/portal/boarding`
- Admissions officer: `/portal/admin/admissions`
- Teacher directory: `/portal/admin/teachers`
- Student and staff attendance: `/portal/admin/attendance`, `/portal/admin/staff-attendance`

These routes require a configured Supabase project and an active account. The student and teacher pages remain starter workspace shells.

## Public pages

The main navigation links to `/school`, `/learning`, `/news`, `/admissions` and `/contact`. The School index and footer link to all other public pages. The public admissions page is `/admissions`; the application form is `/admissions/apply`, and status checks are on `/admissions#check-status`.

Admission status is checked with a random reference and a separate 192-bit access code. The database stores only a SHA-256 hash of that code. Public users cannot select application rows. Application documents use the non-public `admission-documents` storage bucket; only authorized admissions staff can create short-lived download links. Decisions and notes are staff-only, and accepting an application does not create an enrolled student record.

## Next implementation stages

1. Confirm school address, contacts, admissions requirements, fees, school levels/classes, leadership and public policies.
2. Create a Supabase project; copy `.env.example` to `.env.local` and add the project's URL, anon/publishable key, public site URL, and server-only service-role secret. The service-role secret is used only by the server-side admission action for validated intake, rate limiting and private uploads; it must never have a `NEXT_PUBLIC_` prefix or be sent to the browser. Configure Auth email/password, password recovery redirect URLs, and production secrets in Vercel.
3. Review and apply all seven migrations in order: `202610220001_school_portal_foundation.sql` through `202610220007_supabase_security_hardening.sql`. Migration 006 creates the boarding module; migration 007 narrows database grants, ensures private storage settings, rate-limits public application-status checks through the server, audits sensitive changes, and verifies RLS is enabled across private-data tables. Public clients cannot insert or read admission records directly. Create the first Auth account through Supabase, then grant the first administrator role to that exact profile once through the Supabase SQL editor as project owner; never expose the service-role key. Replace the email below with the verified first-admin email:

   ```sql
   update public.profiles p
   set role = 'super_admin', updated_at = now()
   from auth.users u
   where p.id = u.id and lower(u.email) = lower('FIRST-ADMIN-EMAIL');
   ```

   The application intentionally does not let users change account roles. Provision staff and portal accounts through a trusted school process.
4. Create staff accounts through Supabase Auth and assign roles using a trusted school provisioning process. Configure the private document bucket created by migration 3 and test application submission, private status lookup and staff review in a non-production project before opening admissions.
5. Continue implementing operational forms for advanced academics, account provisioning and audit-log review. Configure rooms and staff assignments before boarding staff log in. Only administrators create new student boarding allocations; boarding staff operate on assigned areas, and parents see only published notices and information linked to their children.
6. Add PWA assets and safe offline behavior, then complete security, accessibility, mobile and production build checks before deployment.

### Supabase production settings

- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the project URL and anon/publishable key. Runtime validation rejects HTTP endpoints in production and rejects a service-role JWT or secret key in the public-key variable.
- Set `SUPABASE_SERVICE_ROLE_KEY` only in server environments (local `.env.local` or server deployment secrets). It must be a `service_role` JWT or `sb_secret_` key. Do not add it to `NEXT_PUBLIC_*`, client bundles, logs, or source control. `.env*` files are ignored except `.env.example`.
- In Supabase Auth settings, configure the exact production Site URL and redirect allowlist (including `/auth/callback` and `/reset-password`), enable email/password, and retain/enforce Supabase Auth's sign-in and password-reset rate limits. Use HTTPS for production and configure SMTP before opening account recovery.
- Migrations 003 and 007 use the private rate-limit table and the service-only admission status RPC. Do not grant `check_admission_status` to `anon` or `authenticated`, and keep both upload buckets private.
- The app hashes requester IPs with HMAC before storing rate-limit keys. The configured hosting proxy must set trustworthy `x-real-ip` or `x-forwarded-for` headers; do not accept client-supplied forwarding headers directly in a deployment that does not normalize them.
- This repo has no project URL or Supabase credentials configured, so migrations and Auth dashboard settings must be applied and verified against the school's Supabase project before deployment.

## Deployment

This project has not been deployed. A Vercel deployment should follow the backend/security stages, with the actual production environment variables configured in Vercel. No Supabase credentials are included in this repository. Until `.env.local` and the migrations are configured, sign-in and admission submission deliberately report that setup is pending.

## School contacts and supplied photos

The confirmed public contact defaults are achiermjohnsla@gmail.com and +211 926 100 446. Administrators can replace these values in school settings. Added the supplied school staff event photograph and student group photograph to the gallery; the staff image is also shown on School Leadership. The supplied student group photograph is identified generally and is not described as nursery pupils. A nursery-specific photograph was not included among the supplied images.


