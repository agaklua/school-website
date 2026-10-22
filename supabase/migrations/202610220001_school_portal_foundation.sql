-- Initial identity and access foundation. Apply to a new Supabase project after review.
create type public.school_role as enum (
  'super_admin', 'school_admin', 'teacher', 'parent', 'student', 'bursar', 'boarding_staff', 'admissions_officer'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role public.school_role not null default 'student',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.create_school_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''), 'student');
  return new;
end;
$$;

create trigger on_auth_user_created_school_profile
  after insert on auth.users for each row execute procedure public.create_school_profile();

create or replace function public.is_school_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active
      and p.role in ('super_admin'::public.school_role, 'school_admin'::public.school_role)
  );
$$;

create or replace function public.protect_school_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active)
     and (select auth.uid()) is not null then
    raise exception 'Account role and status changes require trusted provisioning';
  end if;
  new.updated_at = now();
  return new;
end;
$$;
create trigger protect_school_profile_role
  before update on public.profiles for each row execute procedure public.protect_school_role();

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select, update on public.profiles to authenticated;

create policy "Users can read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Administrators can read profiles" on public.profiles
  for select to authenticated using ((select public.is_school_admin()));
create policy "Users can update own non-role fields" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke execute on function public.is_school_admin() from public, anon, authenticated;

comment on table public.profiles is 'Private school portal identities. Role grants must be assigned by a trusted school operator.';
