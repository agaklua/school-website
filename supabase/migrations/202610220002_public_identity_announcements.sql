create table public.school_settings (
  id integer primary key default 1 check (id = 1),
  school_name text not null default 'St. Lawrence Academy' check (char_length(school_name) between 1 and 100),
  acronym text not null default 'SLA' check (char_length(acronym) between 1 and 16),
  motto text not null default 'Education is the key of life' check (char_length(motto) between 1 and 160),
  country text not null default 'South Sudan' check (char_length(country) between 1 and 80),
  address text not null default '' check (char_length(address) <= 200),
  phone text not null default '' check (char_length(phone) <= 40),
  email text not null default '' check (char_length(email) <= 254),
  logo_url text not null default '/images/crest.jpg' check (char_length(logo_url) <= 500),
  primary_color text not null default '#17264b' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null default '#a21d2a' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  updated_at timestamptz not null default now()
);
insert into public.school_settings (id) values (1) on conflict (id) do nothing;
alter table public.school_settings enable row level security;
grant select on public.school_settings to anon, authenticated;
grant insert, update on public.school_settings to authenticated;
create policy "Public may read school identity" on public.school_settings for select to anon, authenticated using (true);
create policy "Administrators may create school identity" on public.school_settings for insert to authenticated with check ((select public.is_school_admin()));
create policy "Administrators may update school identity" on public.school_settings for update to authenticated using ((select public.is_school_admin())) with check ((select public.is_school_admin()));

create table public.announcements (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 140),
  summary text not null check (char_length(summary) between 1 and 300),
  body text not null default '' check (char_length(body) <= 12000),
  category text not null default 'School news' check (char_length(category) between 1 and 50),
  image_url text not null default '' check (char_length(image_url) <= 500),
  published boolean not null default false,
  published_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index announcements_public_feed_idx on public.announcements (published_at desc) where published = true;
alter table public.announcements enable row level security;
grant select on public.announcements to anon, authenticated;
grant insert, update on public.announcements to authenticated;
grant usage, select on sequence public.announcements_id_seq to authenticated;
create policy "Public can read published announcements" on public.announcements for select to anon, authenticated using (published and published_at <= now());
create policy "Administrators can read all announcements" on public.announcements for select to authenticated using ((select public.is_school_admin()));
create policy "Administrators can create announcements" on public.announcements for insert to authenticated with check ((select public.is_school_admin()) and created_by = (select auth.uid()));
create policy "Administrators can update announcements" on public.announcements for update to authenticated using ((select public.is_school_admin())) with check ((select public.is_school_admin()));

grant execute on function public.is_school_admin() to authenticated;
