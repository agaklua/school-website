-- Staff directory, teaching responsibilities, timetables and scoped attendance.
insert into public.role_permissions(role,permission) values
 ('super_admin','teachers.manage'),('school_admin','teachers.manage'),
 ('super_admin','staff_attendance.manage'),('school_admin','staff_attendance.manage')
on conflict do nothing;

create table public.teacher_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete restrict,
  full_name text not null check(char_length(full_name) between 2 and 160),
  staff_number text not null unique check(staff_number ~ '^[A-Z0-9/-]{3,32}$'),
  phone text not null check(char_length(phone) between 6 and 40),
  work_email text check(work_email is null or (char_length(work_email)<=254 and work_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  job_title text not null default 'Teacher' check(char_length(job_title) between 2 and 100),
  employment_status text not null default 'active' check(employment_status in ('active','on_leave','suspended','resigned','terminated')),
  hired_on date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index teacher_profiles_status_idx on public.teacher_profiles(employment_status,staff_number);

create table public.teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_profile_id uuid not null references public.teacher_profiles(id) on delete restrict,
  class_id bigint not null references public.school_classes(id) on delete restrict,
  subject_id bigint not null references public.subjects(id) on delete restrict,
  academic_year_id bigint not null references public.academic_years(id) on delete restrict,
  is_active boolean not null default true,
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  ended_by uuid references public.profiles(id),
  ended_at timestamptz
);
create unique index one_active_teaching_responsibility on public.teaching_assignments(teacher_profile_id,class_id,subject_id,academic_year_id) where is_active;
create index teaching_assignments_teacher_active_idx on public.teaching_assignments(teacher_profile_id,academic_year_id) where is_active;
create index teaching_assignments_class_active_idx on public.teaching_assignments(class_id) where is_active;

create table public.teacher_timetables (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.teaching_assignments(id) on delete cascade,
  weekday smallint not null check(weekday between 1 and 7),
  starts_at time not null,
  ends_at time not null,
  room text not null default '' check(char_length(room)<=80),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check(ends_at>starts_at),
  unique(assignment_id,weekday,starts_at)
);

create table public.staff_attendance (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  school_day date not null default current_date,
  status text not null check(status in ('present','absent','late','excused')),
  note text not null default '' check(char_length(note)<=300),
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(profile_id,school_day)
);
create index staff_attendance_day_idx on public.staff_attendance(school_day,status);

create or replace function public.teacher_can_manage_class(p_class_id bigint)
returns boolean language sql stable security definer set search_path='' as $$
 select (select public.has_school_permission('academics.manage')) or exists(
   select 1 from public.teaching_assignments a
   join public.teacher_profiles tp on tp.id=a.teacher_profile_id
   join public.profiles p on p.id=tp.profile_id and p.active and p.role='teacher'::public.school_role
   join public.school_classes c on c.id=a.class_id and c.active
   join public.subjects s on s.id=a.subject_id and s.active
   join public.academic_years ay on ay.id=a.academic_year_id and ay.active
   where tp.profile_id=(select auth.uid()) and tp.employment_status='active' and a.is_active and a.class_id=p_class_id
 );
$$;
create or replace function public.teacher_can_manage_subject(p_subject_id bigint)
returns boolean language sql stable security definer set search_path='' as $$
 select (select public.has_school_permission('academics.manage')) or exists(
   select 1 from public.teaching_assignments a
   join public.teacher_profiles tp on tp.id=a.teacher_profile_id
   join public.profiles p on p.id=tp.profile_id and p.active and p.role='teacher'::public.school_role
   join public.school_classes c on c.id=a.class_id and c.active
   join public.subjects s on s.id=a.subject_id and s.active
   join public.academic_years ay on ay.id=a.academic_year_id and ay.active
   where tp.profile_id=(select auth.uid()) and tp.employment_status='active' and a.is_active and a.subject_id=p_subject_id
 );
$$;
revoke all on function public.teacher_can_manage_class(bigint) from public,anon;
revoke all on function public.teacher_can_manage_subject(bigint) from public,anon;
grant execute on function public.teacher_can_manage_class(bigint),public.teacher_can_manage_subject(bigint) to authenticated;

create or replace function public.validate_teaching_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_role public.school_role; v_account_active boolean; v_employment text; v_class_level text; v_subject_level text; v_class_year bigint;
begin
 select p.role,p.active,tp.employment_status into v_role,v_account_active,v_employment from public.teacher_profiles tp join public.profiles p on p.id=tp.profile_id where tp.id=new.teacher_profile_id;
 if v_role is distinct from 'teacher'::public.school_role or (new.is_active and (v_employment is distinct from 'active' or not coalesce(v_account_active,false))) then raise exception 'Active assignments require an active teacher account'; end if;
 select school_level,academic_year_id into v_class_level,v_class_year from public.school_classes where id=new.class_id and active;
 select school_level into v_subject_level from public.subjects where id=new.subject_id and active;
 if v_class_level is null or v_subject_level is null or v_class_level<>v_subject_level then raise exception 'Subject and class school levels must match'; end if;
 if v_class_year is not null and v_class_year<>new.academic_year_id then raise exception 'Class and teaching assignment academic years must match'; end if;
 return new;
end; $$;
create trigger validate_teaching_assignment_before_write before insert or update on public.teaching_assignments for each row execute function public.validate_teaching_assignment();

create or replace function public.validate_timetable_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_class bigint; v_teacher uuid;
begin
 select a.class_id,tp.profile_id into v_class,v_teacher from public.teaching_assignments a join public.teacher_profiles tp on tp.id=a.teacher_profile_id join public.school_classes c on c.id=a.class_id and c.active join public.subjects s on s.id=a.subject_id and s.active join public.profiles p on p.id=tp.profile_id and p.role='teacher'::public.school_role and p.active where a.id=new.assignment_id and a.is_active and tp.employment_status='active';
 if v_class is null then raise exception 'Timetable requires an active teaching assignment'; end if;
 if exists(select 1 from public.teacher_timetables t join public.teaching_assignments a on a.id=t.assignment_id join public.teacher_profiles tp on tp.id=a.teacher_profile_id
    where t.id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid) and t.weekday=new.weekday and t.starts_at<new.ends_at and t.ends_at>new.starts_at
    and (a.class_id=v_class or tp.profile_id=v_teacher)) then raise exception 'This time overlaps another class or teacher assignment'; end if;
 return new;
end; $$;
create trigger validate_teacher_timetable_before_write before insert or update on public.teacher_timetables for each row execute function public.validate_timetable_assignment();

create or replace function public.log_teaching_assignment_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
 values((select auth.uid()),case when tg_op='INSERT' then 'teaching_assignment.created' else case when new.is_active then 'teaching_assignment.updated' else 'teaching_assignment.removed' end end,'teaching_assignment',new.id::text,
 jsonb_build_object('teacher_profile_id',new.teacher_profile_id,'class_id',new.class_id,'subject_id',new.subject_id,'academic_year_id',new.academic_year_id));
 return new;
end; $$;
create trigger teaching_assignments_audit after insert or update on public.teaching_assignments for each row execute function public.log_teaching_assignment_change();
create or replace function public.log_staff_attendance_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
 values((select auth.uid()),case when tg_op='INSERT' then 'staff_attendance.created' else 'staff_attendance.updated' end,'staff_attendance',new.id::text,
 jsonb_build_object('profile_id',new.profile_id,'school_day',new.school_day,'status',new.status));
 return new;
end; $$;
create trigger staff_attendance_audit after insert or update on public.staff_attendance for each row execute function public.log_staff_attendance_change();

alter table public.teacher_profiles enable row level security;
alter table public.teaching_assignments enable row level security;
alter table public.teacher_timetables enable row level security;
alter table public.staff_attendance enable row level security;
revoke all on public.teacher_profiles,public.teaching_assignments,public.teacher_timetables,public.staff_attendance from public,anon,authenticated;
grant select,insert,update on public.teacher_profiles,public.teaching_assignments,public.teacher_timetables,public.staff_attendance to authenticated;
revoke all on sequence public.staff_attendance_id_seq from public,anon,authenticated;
grant usage,select on sequence public.staff_attendance_id_seq to authenticated;
revoke update on public.teacher_profiles,public.teaching_assignments,public.teacher_timetables,public.staff_attendance,public.attendance_records from authenticated;
grant update(full_name,phone,work_email,job_title,employment_status,updated_at) on public.teacher_profiles to authenticated;
grant update(is_active,ended_by,ended_at) on public.teaching_assignments to authenticated;
grant update(status,note) on public.staff_attendance to authenticated;
grant update(status) on public.attendance_records to authenticated;

create policy administrators_manage_teacher_profiles on public.teacher_profiles for all to authenticated using((select public.has_school_permission('teachers.manage'))) with check((select public.has_school_permission('teachers.manage')) and (select role from public.profiles where id=profile_id)='teacher'::public.school_role);
create policy teachers_read_own_profile on public.teacher_profiles for select to authenticated using(profile_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='teacher'::public.school_role and p.active));
create policy administrators_insert_teaching_assignments on public.teaching_assignments for insert to authenticated with check((select public.has_school_permission('teachers.manage')) and assigned_by=(select auth.uid()));
create policy administrators_update_teaching_assignments on public.teaching_assignments for update to authenticated using((select public.has_school_permission('teachers.manage'))) with check((select public.has_school_permission('teachers.manage')) and (is_active or ended_by=(select auth.uid())));
create policy administrators_read_teaching_assignments on public.teaching_assignments for select to authenticated using((select public.has_school_permission('teachers.manage')));
create policy teachers_read_own_assignments on public.teaching_assignments for select to authenticated using(exists(select 1 from public.teacher_profiles tp join public.profiles p on p.id=tp.profile_id and p.role='teacher'::public.school_role and p.active join public.academic_years ay on ay.id=academic_year_id where tp.id=teacher_profile_id and tp.profile_id=(select auth.uid()) and tp.employment_status='active' and is_active and ay.active));
create policy administrators_insert_teacher_timetables on public.teacher_timetables for insert to authenticated with check((select public.has_school_permission('teachers.manage')) and created_by=(select auth.uid()));
create policy administrators_update_teacher_timetables on public.teacher_timetables for update to authenticated using((select public.has_school_permission('teachers.manage'))) with check((select public.has_school_permission('teachers.manage')));
create policy administrators_read_teacher_timetables on public.teacher_timetables for select to authenticated using((select public.has_school_permission('teachers.manage')));
create policy teachers_read_own_timetables on public.teacher_timetables for select to authenticated using(exists(select 1 from public.teaching_assignments a join public.teacher_profiles tp on tp.id=a.teacher_profile_id join public.profiles p on p.id=tp.profile_id and p.role='teacher'::public.school_role and p.active join public.academic_years ay on ay.id=a.academic_year_id where a.id=assignment_id and tp.profile_id=(select auth.uid()) and tp.employment_status='active' and a.is_active and ay.active));
create policy administrators_insert_staff_attendance on public.staff_attendance for insert to authenticated with check((select public.has_school_permission('staff_attendance.manage')) and recorded_by=(select auth.uid()));
create policy administrators_update_staff_attendance on public.staff_attendance for update to authenticated using((select public.has_school_permission('staff_attendance.manage'))) with check((select public.has_school_permission('staff_attendance.manage')));
create policy administrators_read_staff_attendance on public.staff_attendance for select to authenticated using((select public.has_school_permission('staff_attendance.manage')));
create policy staff_read_own_attendance on public.staff_attendance for select to authenticated using(profile_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='teacher'::public.school_role and p.active));

drop policy attendance_staff_manage on public.attendance_records;
create policy administrators_insert_student_attendance on public.attendance_records for insert to authenticated with check((select public.has_school_permission('academics.manage')) and recorded_by=(select auth.uid()));
create policy administrators_update_student_attendance on public.attendance_records for update to authenticated using((select public.has_school_permission('academics.manage'))) with check((select public.has_school_permission('academics.manage')));
create policy administrators_read_student_attendance on public.attendance_records for select to authenticated using((select public.has_school_permission('academics.manage')));
create policy assigned_teachers_read_student_attendance on public.attendance_records for select to authenticated using((select public.teacher_can_manage_class(class_id)));
create policy assigned_teachers_insert_student_attendance on public.attendance_records for insert to authenticated with check((select public.teacher_can_manage_class(class_id)) and recorded_by=(select auth.uid()));
create policy assigned_teachers_update_student_attendance on public.attendance_records for update to authenticated using((select public.teacher_can_manage_class(class_id))) with check((select public.teacher_can_manage_class(class_id)));

create policy assigned_teachers_read_classes on public.school_classes for select to authenticated using((select public.teacher_can_manage_class(id)));
create policy assigned_teachers_read_subjects on public.subjects for select to authenticated using((select public.teacher_can_manage_subject(id)));
create policy assigned_teachers_read_academic_years on public.academic_years for select to authenticated using(active and exists(select 1 from public.teaching_assignments a join public.teacher_profiles tp on tp.id=a.teacher_profile_id join public.profiles p on p.id=tp.profile_id and p.role='teacher'::public.school_role and p.active where a.academic_year_id=id and a.is_active and tp.profile_id=(select auth.uid()) and tp.employment_status='active'));
create policy administrators_read_students on public.students for select to authenticated using((select public.has_school_permission('students.manage')));
create policy assigned_teachers_read_students on public.students for select to authenticated using(enrollment_status='enrolled' and class_id is not null and (select public.teacher_can_manage_class(class_id)));

create or replace function public.record_student_class_attendance(p_class_id bigint,p_school_day date,p_records jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare v_record jsonb; v_id uuid; v_status text; v_count integer:=0; v_rows integer;
begin
 if not (select public.has_school_permission('attendance.manage')) or not (select public.teacher_can_manage_class(p_class_id)) then raise exception 'Permission denied'; end if;
 if p_school_day is null or p_school_day>(now() at time zone 'Africa/Juba')::date or p_records is null or jsonb_typeof(p_records) is distinct from 'array' then raise exception 'Invalid attendance submission'; end if;
 if jsonb_array_length(p_records)>1000 then raise exception 'Attendance batch exceeds the maximum roster size'; end if;
 for v_record in select value from jsonb_array_elements(p_records) loop
   v_id:=(v_record->>'student_id')::uuid; v_status:=v_record->>'status';
   if v_status not in ('present','absent','late','excused') then raise exception 'Invalid attendance status'; end if;
   insert into public.attendance_records(student_id,class_id,school_day,status,recorded_by)
   select s.id,p_class_id,p_school_day,v_status,(select auth.uid()) from public.students s
   where s.id=v_id and s.class_id=p_class_id and s.enrollment_status='enrolled'
   on conflict(student_id,school_day) do update set status=excluded.status;
   get diagnostics v_rows=row_count;
   if v_rows<>1 then raise exception 'Student is outside the authorized class roster'; end if;
   v_count:=v_count+1;
 end loop;
 return v_count;
end; $$;
revoke all on function public.record_student_class_attendance(bigint,date,jsonb) from public,anon;
grant execute on function public.record_student_class_attendance(bigint,date,jsonb) to authenticated;

create or replace function public.record_staff_attendance(p_school_day date,p_records jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare v_record jsonb; v_id uuid; v_status text; v_note text; v_count integer:=0; v_rows integer;
begin
 if not (select public.has_school_permission('staff_attendance.manage')) then raise exception 'Permission denied'; end if;
 if p_school_day is null or p_school_day>(now() at time zone 'Africa/Juba')::date or p_records is null or jsonb_typeof(p_records) is distinct from 'array' then raise exception 'Invalid staff attendance submission'; end if;
 if jsonb_array_length(p_records)>500 then raise exception 'Attendance batch exceeds the maximum staff size'; end if;
 for v_record in select value from jsonb_array_elements(p_records) loop
   v_id:=(v_record->>'profile_id')::uuid; v_status:=v_record->>'status'; v_note:=left(coalesce(v_record->>'note',''),300);
   if v_status not in ('present','absent','late','excused') then raise exception 'Invalid staff attendance status'; end if;
   insert into public.staff_attendance(profile_id,school_day,status,note,recorded_by)
   select tp.profile_id,p_school_day,v_status,v_note,(select auth.uid()) from public.teacher_profiles tp
   where tp.profile_id=v_id and tp.employment_status='active'
   on conflict(profile_id,school_day) do update set status=excluded.status,note=excluded.note;
   get diagnostics v_rows=row_count;
   if v_rows<>1 then raise exception 'Staff member is outside the active staff roster'; end if;
   v_count:=v_count+1;
 end loop;
 return v_count;
end; $$;
revoke all on function public.record_staff_attendance(date,jsonb) from public,anon;
grant execute on function public.record_staff_attendance(date,jsonb) to authenticated;

-- Teachers may see and update attendance only for assigned classes; guardian data and staff profiles remain restricted.
