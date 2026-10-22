create table public.admission_applications (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique check (reference_code ~ '^SLA-[A-F0-9]{16}$'),
  access_code_hash text not null check (access_code_hash ~ '^[0-9a-f]{64}$'),
  application_type text not null check (application_type in ('enquiry','application')),
  student_name text not null check (char_length(student_name) between 2 and 120),
  date_of_birth date not null,
  school_level text not null check (school_level in ('baby_class','kindergarten','primary','secondary')),
  parent_name text not null check (char_length(parent_name) between 2 and 120),
  parent_relationship text not null check (char_length(parent_relationship) between 2 and 40),
  parent_email text not null check (char_length(parent_email) <= 254 and parent_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  parent_phone text not null check (char_length(parent_phone) between 6 and 40 and parent_phone ~ '^[+0-9() -]+$'),
  message text not null default '' check (char_length(message) <= 1200),
  document_path text,
  status text not null default 'pending' check (status in ('pending','under_review','accepted','rejected','waitlisted')),
  admin_notes text not null default '' check (char_length(admin_notes) <= 4000),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index admission_applications_recent_idx on public.admission_applications (created_at desc);
create index admission_applications_status_idx on public.admission_applications (status,created_at desc);
alter table public.admission_applications enable row level security;
revoke all on public.admission_applications from anon, authenticated;
grant insert, update on public.admission_applications to service_role;
grant select (id,reference_code,application_type,student_name,date_of_birth,school_level,parent_name,parent_relationship,parent_email,parent_phone,message,document_path,status,admin_notes,reviewed_by,reviewed_at,created_at,updated_at) on public.admission_applications to authenticated;
grant update (status,admin_notes,reviewed_by,reviewed_at,updated_at) on public.admission_applications to authenticated;

create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create table private.admission_rate_limits (
  ip_hash text primary key check (ip_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  attempts integer not null check (attempts between 1 and 100)
);
alter table private.admission_rate_limits enable row level security;
create or replace function public.consume_admission_rate_limit(p_ip_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_attempts integer;
begin
  if p_ip_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  delete from private.admission_rate_limits where window_started_at < now() - interval '1 day';
  insert into private.admission_rate_limits(ip_hash,window_started_at,attempts) values(p_ip_hash,now(),1)
  on conflict (ip_hash) do update set
    attempts=case when now()-private.admission_rate_limits.window_started_at >= interval '15 minutes' then 1 else least(private.admission_rate_limits.attempts+1,100) end,
    window_started_at=case when now()-private.admission_rate_limits.window_started_at >= interval '15 minutes' then now() else private.admission_rate_limits.window_started_at end
  returning attempts into v_attempts;
  return v_attempts <= 5;
end;
$$;
revoke all on function public.consume_admission_rate_limit(text) from public,anon,authenticated;
grant execute on function public.consume_admission_rate_limit(text) to service_role;

create or replace function public.is_admissions_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active
    and p.role in ('super_admin'::public.school_role,'school_admin'::public.school_role,'admissions_officer'::public.school_role));
$$;
revoke all on function public.is_admissions_staff() from public, anon;
grant execute on function public.is_admissions_staff() to authenticated;

create policy "Admissions staff may review applications" on public.admission_applications for select to authenticated
  using ((select public.is_admissions_staff()));
create policy "Admissions staff may update review fields" on public.admission_applications for update to authenticated
  using ((select public.is_admissions_staff()))
  with check ((select public.is_admissions_staff()) and status in ('pending','under_review','accepted','rejected','waitlisted') and reviewed_by=(select auth.uid()));

create or replace function public.check_admission_status(p_reference_code text,p_access_code_hash text)
returns table(reference_code text,status text,submitted_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.reference_code,a.status,a.created_at
  from public.admission_applications a
  where a.reference_code = p_reference_code and a.access_code_hash = p_access_code_hash
  limit 1;
$$;
revoke all on function public.check_admission_status(text,text) from public, authenticated;
grant execute on function public.check_admission_status(text,text) to anon, authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('admission-documents','admission-documents',false,5242880,array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;
create policy "Admissions staff may view private admission documents" on storage.objects for select to authenticated
  using (bucket_id='admission-documents' and (select public.is_admissions_staff()));

create table public.school_events (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 120),
  summary text not null default '' check (char_length(summary) <= 300),
  location text not null default '' check (char_length(location) <= 160),
  starts_at timestamptz not null,
  ends_at timestamptz,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index school_events_upcoming_idx on public.school_events(starts_at) where published=true;
alter table public.school_events enable row level security;
grant select on public.school_events to anon,authenticated;
create policy "Visitors may read published upcoming events" on public.school_events for select to anon,authenticated
  using (published and starts_at >= now());
