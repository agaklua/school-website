-- Core school records and database-backed role permissions.
create table public.role_permissions (role public.school_role not null, permission text not null check(permission ~ '^[a-z][a-z0-9_.-]{1,80}$'), primary key(role,permission));
insert into public.role_permissions(role,permission) values
('super_admin','dashboard.view'),('school_admin','dashboard.view'),('teacher','dashboard.view'),('parent','dashboard.view'),('student','dashboard.view'),('bursar','dashboard.view'),('boarding_staff','dashboard.view'),('admissions_officer','dashboard.view'),
('super_admin','students.manage'),('school_admin','students.manage'),('super_admin','academics.manage'),('school_admin','academics.manage'),
('super_admin','users.manage'),('school_admin','users.manage'),('super_admin','settings.manage'),('school_admin','settings.manage'),
('super_admin','finance.manage'),('school_admin','finance.manage'),('bursar','finance.manage'),('super_admin','boarding.manage'),('school_admin','boarding.manage'),('boarding_staff','boarding.manage'),
('super_admin','announcements.manage'),('school_admin','announcements.manage'),('super_admin','admissions.manage'),('school_admin','admissions.manage'),('admissions_officer','admissions.manage'),
('super_admin','attendance.manage'),('school_admin','attendance.manage'),('teacher','attendance.manage'),('super_admin','reports.view'),('school_admin','reports.view'),('bursar','reports.view'),('teacher','reports.view'),('super_admin','audit.view'),('school_admin','audit.view') on conflict do nothing;
create or replace function public.has_school_permission(p_permission text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.role_permissions rp on rp.role=p.role where p.id=(select auth.uid()) and p.active and rp.permission=p_permission);
$$;
revoke all on function public.has_school_permission(text) from public,anon; grant execute on function public.has_school_permission(text) to authenticated;
alter table public.role_permissions enable row level security; revoke all on public.role_permissions from public,anon,authenticated; grant select on public.role_permissions to authenticated;
create policy role_permissions_read_self on public.role_permissions for select to authenticated using(role=(select p.role from public.profiles p where p.id=(select auth.uid()) and p.active));

create table public.academic_years(id bigint generated always as identity primary key,name text not null unique check(char_length(name) between 4 and 40),starts_on date not null,ends_on date not null,active boolean not null default false,check(ends_on>=starts_on));
create unique index one_active_academic_year on public.academic_years(active) where active;
create table public.school_terms(id bigint generated always as identity primary key,academic_year_id bigint not null references public.academic_years(id),name text not null check(char_length(name) between 1 and 60),starts_on date not null,ends_on date not null,check(ends_on>=starts_on),unique(academic_year_id,name));
create table public.school_classes(id bigint generated always as identity primary key,name text not null check(char_length(name) between 1 and 80),school_level text not null check(school_level in ('baby_class','kindergarten','primary','secondary')),academic_year_id bigint references public.academic_years(id),capacity integer not null default 0 check(capacity>=0),active boolean not null default true,created_at timestamptz not null default now(),unique(name,academic_year_id));
create table public.subjects(id bigint generated always as identity primary key,name text not null check(char_length(name) between 1 and 100),school_level text not null check(school_level in ('baby_class','kindergarten','primary','secondary')),active boolean not null default true,unique(name,school_level));
create table public.students(id uuid primary key default gen_random_uuid(),admission_number text not null unique check(admission_number ~ '^[A-Z0-9/-]{3,32}$'),full_name text not null check(char_length(full_name) between 2 and 160),date_of_birth date not null check(date_of_birth<current_date),school_level text not null check(school_level in ('baby_class','kindergarten','primary','secondary')),class_id bigint references public.school_classes(id),academic_year_id bigint not null references public.academic_years(id),enrollment_status text not null default 'enrolled' check(enrollment_status in ('enrolled','pending','withdrawn','graduated','suspended')),admission_date date not null default current_date,photo_path text,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index students_active_level_idx on public.students(school_level,enrollment_status);
create table public.guardians(id uuid primary key default gen_random_uuid(),profile_id uuid unique references public.profiles(id) on delete set null,full_name text not null check(char_length(full_name) between 2 and 160),email text check(email is null or char_length(email)<=254),phone text not null check(char_length(phone) between 6 and 40),created_at timestamptz not null default now());
create table public.student_guardians(student_id uuid not null references public.students(id) on delete cascade,guardian_id uuid not null references public.guardians(id) on delete cascade,relationship text not null check(char_length(relationship) between 2 and 40),is_primary boolean not null default false,primary key(student_id,guardian_id));
create table public.attendance_records(id bigint generated always as identity primary key,student_id uuid not null references public.students(id) on delete cascade,class_id bigint not null references public.school_classes(id),school_day date not null default current_date,status text not null check(status in ('present','absent','late','excused')),recorded_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),unique(student_id,school_day));
create table public.fee_invoices(id bigint generated always as identity primary key,student_id uuid not null references public.students(id),academic_year_id bigint not null references public.academic_years(id),amount_due numeric(12,2) not null check(amount_due>=0),currency char(3) not null default 'SSP',status text not null default 'issued' check(status in ('issued','paid','void')),due_on date,created_at timestamptz not null default now());
create table public.fee_payments(id bigint generated always as identity primary key,invoice_id bigint not null references public.fee_invoices(id),amount numeric(12,2) not null check(amount>0),received_at timestamptz not null default now(),recorded_by uuid not null references public.profiles(id),receipt_number text unique);
create table public.boarding_beds(id bigint generated always as identity primary key,dormitory text not null check(char_length(dormitory) between 1 and 100),bed_label text not null check(char_length(bed_label) between 1 and 40),student_id uuid unique references public.students(id),active boolean not null default true,unique(dormitory,bed_label));
create table public.audit_logs(id bigint generated always as identity primary key,actor_id uuid references public.profiles(id) on delete set null,action text not null,entity_type text not null,entity_id text,details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
create index audit_logs_recent_idx on public.audit_logs(created_at desc);
create or replace function public.log_student_change() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values((select auth.uid()),case when tg_op='INSERT' then 'student.created' else 'student.updated' end,'student',new.id::text,jsonb_build_object('admission_number',new.admission_number,'enrollment_status',new.enrollment_status)); return new; end; $$;
create trigger students_audit_trigger after insert or update on public.students for each row execute function public.log_student_change();

alter table public.academic_years enable row level security; alter table public.school_terms enable row level security; alter table public.school_classes enable row level security;
alter table public.subjects enable row level security; alter table public.students enable row level security; alter table public.guardians enable row level security;
alter table public.student_guardians enable row level security; alter table public.attendance_records enable row level security; alter table public.fee_invoices enable row level security;
alter table public.fee_payments enable row level security; alter table public.boarding_beds enable row level security; alter table public.audit_logs enable row level security;
revoke all on public.academic_years,public.school_terms,public.school_classes,public.subjects,public.students,public.guardians,public.student_guardians,public.attendance_records,public.fee_invoices,public.fee_payments,public.boarding_beds,public.audit_logs from anon;
grant select,insert,update on public.academic_years,public.school_terms,public.school_classes,public.subjects,public.students,public.guardians,public.student_guardians,public.attendance_records,public.fee_invoices,public.fee_payments,public.boarding_beds to authenticated;
revoke update on public.students from authenticated;
grant update(full_name,date_of_birth,school_level,class_id,academic_year_id,enrollment_status,admission_date,photo_path,updated_at) on public.students to authenticated;
grant select on public.audit_logs to authenticated; grant usage,select on all sequences in schema public to authenticated;
create policy school_admin_manage_years on public.academic_years for all to authenticated using((select public.has_school_permission('academics.manage'))) with check((select public.has_school_permission('academics.manage')));
create policy school_admin_manage_terms on public.school_terms for all to authenticated using((select public.has_school_permission('academics.manage'))) with check((select public.has_school_permission('academics.manage')));
create policy school_admin_manage_classes on public.school_classes for all to authenticated using((select public.has_school_permission('academics.manage'))) with check((select public.has_school_permission('academics.manage')));
create policy school_admin_manage_subjects on public.subjects for all to authenticated using((select public.has_school_permission('academics.manage'))) with check((select public.has_school_permission('academics.manage')));
create policy school_admin_insert_students on public.students for insert to authenticated with check((select public.has_school_permission('students.manage')) and created_by=(select auth.uid()));
create policy school_admin_update_students on public.students for update to authenticated using((select public.has_school_permission('students.manage'))) with check((select public.has_school_permission('students.manage')));
create policy school_admin_delete_students on public.students for delete to authenticated using((select public.has_school_permission('students.manage')));
create policy school_admin_manage_guardians on public.guardians for all to authenticated using((select public.has_school_permission('students.manage'))) with check((select public.has_school_permission('students.manage')));
create policy school_admin_manage_student_guardians on public.student_guardians for all to authenticated using((select public.has_school_permission('students.manage'))) with check((select public.has_school_permission('students.manage')));
create policy attendance_staff_manage on public.attendance_records for all to authenticated using((select public.has_school_permission('attendance.manage'))) with check((select public.has_school_permission('attendance.manage')) and recorded_by=(select auth.uid()));
create policy finance_staff_manage_invoices on public.fee_invoices for all to authenticated using((select public.has_school_permission('finance.manage'))) with check((select public.has_school_permission('finance.manage')));
create policy finance_staff_manage_payments on public.fee_payments for all to authenticated using((select public.has_school_permission('finance.manage'))) with check((select public.has_school_permission('finance.manage')) and recorded_by=(select auth.uid()));
create policy boarding_staff_manage_beds on public.boarding_beds for all to authenticated using((select public.has_school_permission('boarding.manage'))) with check((select public.has_school_permission('boarding.manage')));
create policy administrators_read_audit on public.audit_logs for select to authenticated using((select public.has_school_permission('audit.view')));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('student-photos','student-photos',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy student_photos_admin_read on storage.objects for select to authenticated using(bucket_id='student-photos' and (select public.has_school_permission('students.manage')));
create policy student_photos_admin_upload on storage.objects for insert to authenticated with check(bucket_id='student-photos' and (select public.has_school_permission('students.manage')));
create policy student_photos_admin_update on storage.objects for update to authenticated using(bucket_id='student-photos' and (select public.has_school_permission('students.manage'))) with check(bucket_id='student-photos' and (select public.has_school_permission('students.manage')));

create or replace function public.register_student(p_student_id uuid,p_admission_number text,p_full_name text,p_date_of_birth date,p_school_level text,p_class_id bigint,p_academic_year_id bigint,p_enrollment_status text,p_admission_date date,p_guardian_name text,p_guardian_email text,p_guardian_phone text,p_guardian_relationship text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_guardian uuid;
begin
  if not (select public.has_school_permission('students.manage')) then raise exception 'Permission denied'; end if;
  if p_class_id is not null and not exists(select 1 from public.school_classes c where c.id=p_class_id and c.school_level=p_school_level and c.active) then raise exception 'Selected class does not match the school level'; end if;
  insert into public.guardians(full_name,email,phone) values(p_guardian_name,nullif(p_guardian_email,''),p_guardian_phone) returning id into v_guardian;
  insert into public.students(id,admission_number,full_name,date_of_birth,school_level,class_id,academic_year_id,enrollment_status,admission_date,created_by)
    values(p_student_id,p_admission_number,p_full_name,p_date_of_birth,p_school_level,p_class_id,p_academic_year_id,p_enrollment_status,p_admission_date,(select auth.uid()));
  insert into public.student_guardians(student_id,guardian_id,relationship,is_primary) values(p_student_id,v_guardian,p_guardian_relationship,true);
  return p_student_id;
end; $$;
revoke all on function public.register_student(uuid,text,text,date,text,bigint,bigint,text,date,text,text,text,text) from public,anon;
grant execute on function public.register_student(uuid,text,text,date,text,bigint,bigint,text,date,text,text,text,text) to authenticated;

create or replace function public.activate_academic_year(p_id bigint)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  if not (select public.has_school_permission('academics.manage')) then raise exception 'Permission denied'; end if;
  update public.academic_years set active=false where active=true;
  update public.academic_years set active=true where id=p_id;
  if not found then raise exception 'Academic year does not exist'; end if;
  return true;
end; $$;
revoke all on function public.activate_academic_year(bigint) from public,anon;
grant execute on function public.activate_academic_year(bigint) to authenticated;
