-- Separate, time-aware boarding records. The legacy boarding_beds table remains
-- intact for deployments that have already applied migration 004.
create table public.boarding_buildings (
 id bigint generated always as identity primary key,
 name text not null check(char_length(name) between 1 and 100),
 description text,
 active boolean not null default true,
 created_at timestamptz not null default now(), unique(name)
);
create table public.boarding_dormitories (
 id bigint generated always as identity primary key,
 building_id bigint not null references public.boarding_buildings(id),
 name text not null check(char_length(name) between 1 and 100),
 eligible_gender text check(eligible_gender is null or eligible_gender in ('girls','boys','any')),
 active boolean not null default true, unique(building_id,name)
);
create table public.boarding_rooms (
 id bigint generated always as identity primary key,
 dormitory_id bigint not null references public.boarding_dormitories(id),
 room_label text not null check(char_length(room_label) between 1 and 40),
 capacity integer not null check(capacity between 1 and 100),
 active boolean not null default true, unique(dormitory_id,room_label)
);
create table public.boarding_bed_inventory (
 id bigint generated always as identity primary key,
 room_id bigint not null references public.boarding_rooms(id),
 bed_label text not null check(char_length(bed_label) between 1 and 40),
 active boolean not null default true, unique(room_id,bed_label)
);
create or replace function public.validate_boarding_room_capacity() returns trigger language plpgsql security definer set search_path='' as $$
declare v_capacity integer; v_beds integer;
begin
 if tg_table_name='boarding_rooms' then
  select count(*) into v_beds from public.boarding_bed_inventory where room_id=new.id and active;
  if new.capacity<v_beds then raise exception 'Room capacity cannot be below active bed inventory'; end if;
 else
  select capacity into v_capacity from public.boarding_rooms where id=new.room_id for update;
  select count(*) into v_beds from public.boarding_bed_inventory where room_id=new.room_id and active and id is distinct from new.id;
  if new.active and v_beds>=v_capacity then raise exception 'Room bed inventory cannot exceed configured capacity'; end if;
 end if;
 return new;
end; $$;
create trigger boarding_room_capacity_update before update of capacity on public.boarding_rooms for each row execute function public.validate_boarding_room_capacity();
create trigger boarding_bed_capacity before insert or update of room_id,active on public.boarding_bed_inventory for each row execute function public.validate_boarding_room_capacity();
create table public.boarding_staff_assignments (
 id bigint generated always as identity primary key,
 profile_id uuid not null references public.profiles(id),
 building_id bigint references public.boarding_buildings(id),
 dormitory_id bigint references public.boarding_dormitories(id),
 room_id bigint references public.boarding_rooms(id),
 starts_on date not null default current_date,
 ends_on date, active boolean not null default true,
 assigned_by uuid not null references public.profiles(id),
 check(ends_on is null or ends_on>=starts_on),
 check(num_nonnulls(building_id,dormitory_id,room_id)=1)
);
create table public.boarding_allocations (
 id bigint generated always as identity primary key,
 student_id uuid not null references public.students(id),
 bed_id bigint not null references public.boarding_bed_inventory(id),
 starts_on date not null,
 ends_on date,
 status text not null default 'planned' check(status in ('planned','active','ended','cancelled')),
 boarding_fee numeric(12,2) not null default 0 check(boarding_fee>=0),
 fee_currency char(3) not null default 'SSP',
 notes text,
 allocated_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 check(ends_on is null or ends_on>=starts_on)
);
create index boarding_allocations_student_dates on public.boarding_allocations(student_id,starts_on,ends_on);
create index boarding_allocations_bed_dates on public.boarding_allocations(bed_id,starts_on,ends_on);
create table public.boarding_fee_charges (
 id bigint generated always as identity primary key,
 student_id uuid not null references public.students(id),
 allocation_id bigint references public.boarding_allocations(id),
 description text not null check(char_length(description) between 1 and 140),
 amount numeric(12,2) not null check(amount>=0), currency char(3) not null default 'SSP',
 due_on date, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table public.boarding_fee_payments (
 id bigint generated always as identity primary key,
 charge_id bigint not null references public.boarding_fee_charges(id),
 amount numeric(12,2) not null check(amount>0), received_at timestamptz not null default now(),
 receipt_number text unique, recorded_by uuid not null references public.profiles(id)
);
create table public.boarding_roll_call (
 id bigint generated always as identity primary key,
 student_id uuid not null references public.students(id),
 allocation_id bigint not null references public.boarding_allocations(id),
 roll_date date not null default current_date,
 session text not null default 'evening' check(session in ('morning','evening')),
 status text not null check(status in ('present','absent','late','excused')),
 note text check(note is null or char_length(note)<=300),
 recorded_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), unique(student_id,roll_date,session)
);
create table public.boarding_movements (
 id bigint generated always as identity primary key,
 student_id uuid not null references public.students(id),
 allocation_id bigint not null references public.boarding_allocations(id),
 movement text not null check(movement in ('check_in','check_out')),
 occurred_at timestamptz not null default now(),
 authorized_by uuid not null references public.profiles(id),
 note text check(note is null or char_length(note)<=300)
);
create table public.boarding_announcements (
 id bigint generated always as identity primary key,
 title text not null check(char_length(title) between 3 and 140),
 body text not null check(char_length(body) between 1 and 5000),
 published boolean not null default false,
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), published_at timestamptz
);
create or replace function public.validate_boarding_assignment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles p where p.id=new.profile_id and p.role='boarding_staff' and p.active) then raise exception 'An active boarding staff account is required'; end if;
 if tg_op='INSERT' and new.assigned_by is distinct from (select auth.uid()) and (select auth.uid()) is not null then raise exception 'Assignment actor must match the signed-in administrator'; end if;
 return new;
end; $$;
create trigger boarding_assignment_validate before insert or update on public.boarding_staff_assignments for each row execute function public.validate_boarding_assignment();
create or replace function public.validate_boarding_payment() returns trigger language plpgsql security definer set search_path='' as $$
declare v_charge bigint; v_amount numeric; v_paid numeric;
begin
 if tg_op='UPDATE' and old.charge_id is distinct from new.charge_id then raise exception 'A payment cannot be moved to another fee charge'; end if;
 select id,amount into v_charge,v_amount from public.boarding_fee_charges where id=new.charge_id for update;
 if v_charge is null then raise exception 'Boarding fee charge does not exist'; end if;
 select coalesce(sum(amount),0) into v_paid from public.boarding_fee_payments where charge_id=new.charge_id and id is distinct from new.id;
 if new.amount+v_paid>v_amount then raise exception 'Payment cannot exceed the remaining boarding fee balance'; end if;
 return new;
end; $$;
create trigger boarding_payment_validate before insert or update on public.boarding_fee_payments for each row execute function public.validate_boarding_payment();
create or replace function public.validate_boarding_fee_charge() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.allocation_id is not null and not exists(select 1 from public.boarding_allocations a where a.id=new.allocation_id and a.student_id=new.student_id) then raise exception 'Fee student must match the linked boarding allocation'; end if;
 return new;
end; $$;
create trigger boarding_fee_charge_validate before insert or update on public.boarding_fee_charges for each row execute function public.validate_boarding_fee_charge();
revoke all on function public.validate_boarding_assignment(),public.validate_boarding_payment(),public.validate_boarding_fee_charge() from public,anon,authenticated;

create or replace function public.is_boarding_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('super_admin','school_admin'));
$$;
create or replace function public.is_guardian_of_student(p_student uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.student_guardians sg join public.guardians g on g.id=sg.guardian_id where sg.student_id=p_student and g.profile_id=(select auth.uid()));
$$;
create or replace function public.can_manage_boarding_room(p_room bigint) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_boarding_admin() or exists(
  select 1 from public.profiles p join public.boarding_staff_assignments a on a.profile_id=p.id
  join public.boarding_rooms r on r.id=p_room
  join public.boarding_dormitories d on d.id=r.dormitory_id
  where p.id=(select auth.uid()) and p.active and p.role='boarding_staff' and a.active
   and current_date between a.starts_on and coalesce(a.ends_on,'infinity'::date)
   and (a.room_id=r.id or a.dormitory_id=d.id or a.building_id=d.building_id)
 );
$$;
create or replace function public.can_manage_boarding_bed(p_bed bigint) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.boarding_bed_inventory b where b.id=p_bed and public.can_manage_boarding_room(b.room_id));
$$;
revoke all on function public.is_boarding_admin(),public.is_guardian_of_student(uuid),public.can_manage_boarding_room(bigint),public.can_manage_boarding_bed(bigint) from public,anon;
grant execute on function public.is_boarding_admin(),public.is_guardian_of_student(uuid),public.can_manage_boarding_room(bigint),public.can_manage_boarding_bed(bigint) to authenticated;

-- Lock the target room while checking both bed and room constraints so concurrent
-- allocations cannot overbook the same bed or capacity.
create or replace function public.validate_boarding_allocation() returns trigger language plpgsql security definer set search_path='' as $$
declare v_room bigint; v_capacity integer; v_count integer; v_oldroom bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(new.student_id::text,0));
 if tg_op='INSERT' and new.allocated_by is distinct from (select auth.uid()) and (select auth.uid()) is not null then raise exception 'Allocation actor must match the signed-in user'; end if;
 if not exists(select 1 from public.students s where s.id=new.student_id and s.enrollment_status='enrolled') then raise exception 'Student is not currently enrolled'; end if;
 select room_id into v_room from public.boarding_bed_inventory where id=new.bed_id and active for update;
 if v_room is null then raise exception 'Bed is inactive or does not exist'; end if;
 if tg_op='UPDATE' and old.bed_id is distinct from new.bed_id then
  select room_id into v_oldroom from public.boarding_bed_inventory where id=old.bed_id for update;
 end if;
 if not exists(select 1 from public.boarding_rooms r join public.boarding_dormitories d on d.id=r.dormitory_id join public.boarding_buildings b on b.id=d.building_id where r.id=v_room and r.active and d.active and b.active) then raise exception 'Room or boarding facility is inactive'; end if;
 if new.status in ('planned','active') then
  if exists(select 1 from public.boarding_allocations a where a.bed_id=new.bed_id and a.status in ('planned','active') and a.id is distinct from new.id and a.starts_on<=coalesce(new.ends_on,'infinity'::date) and new.starts_on<=coalesce(a.ends_on,'infinity'::date)) then raise exception 'Bed is already allocated for overlapping dates'; end if;
  if exists(select 1 from public.boarding_allocations a where a.student_id=new.student_id and a.status in ('planned','active') and a.id is distinct from new.id and a.starts_on<=coalesce(new.ends_on,'infinity'::date) and new.starts_on<=coalesce(a.ends_on,'infinity'::date)) then raise exception 'Student already has an overlapping boarding allocation'; end if;
  select capacity into v_capacity from public.boarding_rooms where id=v_room for update;
  select count(*) into v_count from public.boarding_allocations a join public.boarding_bed_inventory bi on bi.id=a.bed_id where bi.room_id=v_room and a.status in ('planned','active') and a.id is distinct from new.id and a.starts_on<=coalesce(new.ends_on,'infinity'::date) and new.starts_on<=coalesce(a.ends_on,'infinity'::date);
  if v_count>=v_capacity then raise exception 'Room capacity would be exceeded'; end if;
 end if;
 return new;
end; $$;
revoke all on function public.validate_boarding_allocation(),public.validate_boarding_room_capacity() from public,anon,authenticated;
create trigger boarding_allocation_validate before insert or update on public.boarding_allocations for each row execute function public.validate_boarding_allocation();

create or replace function public.create_boarding_allocation(p_student uuid,p_bed bigint,p_starts date,p_ends date,p_fee numeric,p_currency text,p_notes text default null) returns bigint language plpgsql security invoker set search_path='' as $$
declare v_id bigint;
begin
 if p_starts is null or p_fee is null or p_fee<0 or p_currency !~ '^[A-Z]{3}$' or (p_ends is not null and p_ends<p_starts) then raise exception 'Invalid boarding allocation details'; end if;
 if not exists(select 1 from public.students where id=p_student and enrollment_status='enrolled') then raise exception 'Student is not currently enrolled'; end if;
 if not (select public.can_manage_boarding_bed(p_bed)) then raise exception 'You are not assigned to this boarding room'; end if;
 insert into public.boarding_allocations(student_id,bed_id,starts_on,ends_on,status,boarding_fee,fee_currency,notes,allocated_by)
 values(p_student,p_bed,p_starts,p_ends,case when p_starts<=current_date and (p_ends is null or p_ends>=current_date) then 'active' else 'planned' end,p_fee,p_currency,nullif(left(trim(coalesce(p_notes,'')),1000),''),(select auth.uid())) returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.create_boarding_allocation(uuid,bigint,date,date,numeric,text,text) from public,anon;
grant execute on function public.create_boarding_allocation(uuid,bigint,date,date,numeric,text,text) to authenticated;

create or replace function public.record_boarding_roll_call(p_date date,p_session text,p_records jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare rec jsonb; v_count integer:=0; v_student uuid; v_alloc bigint; v_status text; v_note text;
begin
 if p_date>current_date or p_session not in ('morning','evening') or jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)>1000 then raise exception 'Invalid roll-call submission'; end if;
 for rec in select * from jsonb_array_elements(p_records) loop
  v_student:=(rec->>'student_id')::uuid; v_alloc:=(rec->>'allocation_id')::bigint; v_status:=rec->>'status'; v_note:=left(coalesce(rec->>'note',''),300);
  if v_status not in ('present','absent','late','excused') or not exists(select 1 from public.boarding_allocations a join public.boarding_bed_inventory bi on bi.id=a.bed_id where a.id=v_alloc and a.student_id=v_student and a.status='active' and a.starts_on<=p_date and (a.ends_on is null or a.ends_on>=p_date) and public.can_manage_boarding_room(bi.room_id)) then raise exception 'Invalid allocation or unauthorized room'; end if;
  insert into public.boarding_roll_call(student_id,allocation_id,roll_date,session,status,note,recorded_by) values(v_student,v_alloc,p_date,p_session,v_status,nullif(v_note,''),(select auth.uid())) on conflict(student_id,roll_date,session) do update set allocation_id=excluded.allocation_id,status=excluded.status,note=excluded.note,recorded_by=excluded.recorded_by;
  v_count:=v_count+1;
 end loop;
 return v_count;
end; $$;
revoke all on function public.record_boarding_roll_call(date,text,jsonb) from public,anon;
grant execute on function public.record_boarding_roll_call(date,text,jsonb) to authenticated;

create or replace function public.record_boarding_movement(p_allocation bigint,p_movement text,p_note text default null) returns bigint language plpgsql security invoker set search_path='' as $$
declare v_student uuid; v_room bigint; v_id bigint;
begin
 if p_movement not in ('check_in','check_out') then raise exception 'Invalid movement'; end if;
 select a.student_id,bi.room_id into v_student,v_room from public.boarding_allocations a join public.boarding_bed_inventory bi on bi.id=a.bed_id where a.id=p_allocation and a.status='active' and a.starts_on<=current_date and (a.ends_on is null or a.ends_on>=current_date);
 if v_student is null or not public.can_manage_boarding_room(v_room) then raise exception 'Active allocation or assigned room required'; end if;
 insert into public.boarding_movements(student_id,allocation_id,movement,authorized_by,note) values(v_student,p_allocation,p_movement,(select auth.uid()),nullif(left(trim(coalesce(p_note,'')),300),'')) returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.record_boarding_movement(bigint,text,text) from public,anon;
grant execute on function public.record_boarding_movement(bigint,text,text) to authenticated;

alter table public.boarding_buildings enable row level security;
alter table public.boarding_dormitories enable row level security;
alter table public.boarding_rooms enable row level security;
alter table public.boarding_bed_inventory enable row level security;
alter table public.boarding_staff_assignments enable row level security;
alter table public.boarding_allocations enable row level security;
alter table public.boarding_fee_charges enable row level security;
alter table public.boarding_fee_payments enable row level security;
alter table public.boarding_roll_call enable row level security;
alter table public.boarding_movements enable row level security;
alter table public.boarding_announcements enable row level security;
revoke all on public.boarding_buildings,public.boarding_dormitories,public.boarding_rooms,public.boarding_bed_inventory,public.boarding_staff_assignments,public.boarding_allocations,public.boarding_fee_charges,public.boarding_fee_payments,public.boarding_roll_call,public.boarding_movements,public.boarding_announcements from public,anon;
grant select,insert,update,delete on public.boarding_buildings,public.boarding_dormitories,public.boarding_rooms,public.boarding_bed_inventory,public.boarding_staff_assignments,public.boarding_allocations,public.boarding_fee_charges,public.boarding_fee_payments,public.boarding_roll_call,public.boarding_movements,public.boarding_announcements to authenticated;
grant usage,select on all sequences in schema public to authenticated;

-- Boarding staff can see the minimum student profile only after an allocation
-- places that student in a room within the staff member's assigned scope.
create policy boarding_staff_read_allocated_students on public.students for select to authenticated using(exists(select 1 from public.boarding_allocations a where a.student_id=id and a.status in ('planned','active') and public.can_manage_boarding_bed(a.bed_id)));
create policy guardians_read_linked_students on public.students for select to authenticated using(public.is_guardian_of_student(id));

create policy boarding_building_read on public.boarding_buildings for select to authenticated using(public.is_boarding_admin() or exists(select 1 from public.boarding_staff_assignments a join public.profiles p on p.id=a.profile_id and p.active and p.role='boarding_staff' where a.profile_id=(select auth.uid()) and a.active and current_date between a.starts_on and coalesce(a.ends_on,'infinity'::date) and (a.building_id=id or a.dormitory_id in(select d.id from public.boarding_dormitories d where d.building_id=id) or a.room_id in(select r.id from public.boarding_rooms r join public.boarding_dormitories d on d.id=r.dormitory_id where d.building_id=id))) or exists(select 1 from public.boarding_allocations a join public.boarding_bed_inventory bi on bi.id=a.bed_id join public.boarding_rooms r on r.id=bi.room_id join public.boarding_dormitories d on d.id=r.dormitory_id where d.building_id=id and a.student_id in(select sg.student_id from public.student_guardians sg join public.guardians g on g.id=sg.guardian_id where g.profile_id=(select auth.uid())) and a.status='active'));
create policy boarding_building_admin on public.boarding_buildings for all to authenticated using(public.is_boarding_admin()) with check(public.is_boarding_admin());
create policy boarding_dormitory_read on public.boarding_dormitories for select to authenticated using(public.is_boarding_admin() or public.can_manage_boarding_room((select r.id from public.boarding_rooms r where r.dormitory_id=id limit 1)) or exists(select 1 from public.boarding_allocations a join public.boarding_bed_inventory bi on bi.id=a.bed_id join public.boarding_rooms r on r.id=bi.room_id where r.dormitory_id=id and public.is_guardian_of_student(a.student_id) and a.status='active'));
create policy boarding_dormitory_admin on public.boarding_dormitories for all to authenticated using(public.is_boarding_admin()) with check(public.is_boarding_admin());
create policy boarding_room_read on public.boarding_rooms for select to authenticated using(public.can_manage_boarding_room(id) or exists(select 1 from public.boarding_allocations a join public.boarding_bed_inventory bi on bi.id=a.bed_id where bi.room_id=id and public.is_guardian_of_student(a.student_id) and a.status='active'));
create policy boarding_room_admin on public.boarding_rooms for all to authenticated using(public.is_boarding_admin()) with check(public.is_boarding_admin());
create policy boarding_bed_read on public.boarding_bed_inventory for select to authenticated using(public.can_manage_boarding_room(room_id) or exists(select 1 from public.boarding_allocations a where a.bed_id=id and public.is_guardian_of_student(a.student_id) and a.status='active'));
create policy boarding_bed_admin on public.boarding_bed_inventory for all to authenticated using(public.is_boarding_admin()) with check(public.is_boarding_admin());
create policy boarding_assignments_admin on public.boarding_staff_assignments for all to authenticated using(public.is_boarding_admin()) with check(public.is_boarding_admin());
create policy boarding_assignments_self on public.boarding_staff_assignments for select to authenticated using(profile_id=(select auth.uid()));
create policy boarding_allocation_read on public.boarding_allocations for select to authenticated using(public.can_manage_boarding_bed(bed_id) or (public.is_guardian_of_student(student_id) and status='active'));
create policy boarding_allocation_admin on public.boarding_allocations for all to authenticated using(public.is_boarding_admin()) with check(public.is_boarding_admin());
create policy boarding_allocation_staff_insert on public.boarding_allocations for insert to authenticated with check(public.can_manage_boarding_bed(bed_id) and allocated_by=(select auth.uid()));
create policy boarding_fees_read on public.boarding_fee_charges for select to authenticated using(public.is_boarding_admin() or exists(select 1 from public.boarding_allocations a join public.boarding_bed_inventory b on b.id=a.bed_id where a.id=allocation_id and public.can_manage_boarding_room(b.room_id)) or public.is_guardian_of_student(student_id));
create policy boarding_fees_admin on public.boarding_fee_charges for all to authenticated using(public.is_boarding_admin()) with check(public.is_boarding_admin());
create policy boarding_payments_read on public.boarding_fee_payments for select to authenticated using(public.is_boarding_admin() or exists(select 1 from public.boarding_fee_charges c where c.id=charge_id and (public.is_guardian_of_student(c.student_id) or exists(select 1 from public.boarding_allocations a join public.boarding_bed_inventory b on b.id=a.bed_id where a.id=c.allocation_id and public.can_manage_boarding_room(b.room_id)))));
create policy boarding_payments_admin on public.boarding_fee_payments for all to authenticated using(public.is_boarding_admin()) with check(public.is_boarding_admin());
create policy boarding_roll_call_read on public.boarding_roll_call for select to authenticated using(public.is_guardian_of_student(student_id) or exists(select 1 from public.boarding_allocations a join public.boarding_bed_inventory b on b.id=a.bed_id where a.id=allocation_id and public.can_manage_boarding_room(b.room_id)));
create policy boarding_roll_call_admin on public.boarding_roll_call for all to authenticated using(public.is_boarding_admin()) with check(public.is_boarding_admin() and recorded_by=(select auth.uid()));
create policy boarding_roll_call_staff_insert on public.boarding_roll_call for insert to authenticated with check(recorded_by=(select auth.uid()) and exists(select 1 from public.boarding_allocations a join public.boarding_bed_inventory b on b.id=a.bed_id where a.id=boarding_roll_call.allocation_id and a.student_id=boarding_roll_call.student_id and public.can_manage_boarding_room(b.room_id)));
create policy boarding_roll_call_staff_update on public.boarding_roll_call for update to authenticated using(exists(select 1 from public.boarding_allocations a join public.boarding_bed_inventory b on b.id=a.bed_id where a.id=allocation_id and public.can_manage_boarding_room(b.room_id))) with check(recorded_by=(select auth.uid()));
create policy boarding_movement_read on public.boarding_movements for select to authenticated using(public.is_boarding_admin() or exists(select 1 from public.boarding_allocations a join public.boarding_bed_inventory b on b.id=a.bed_id where a.id=allocation_id and public.can_manage_boarding_room(b.room_id)) or public.is_guardian_of_student(student_id));
create policy boarding_movement_admin on public.boarding_movements for all to authenticated using(public.is_boarding_admin()) with check(public.is_boarding_admin() and authorized_by=(select auth.uid()));
create policy boarding_movement_staff_insert on public.boarding_movements for insert to authenticated with check(authorized_by=(select auth.uid()) and exists(select 1 from public.boarding_allocations a join public.boarding_bed_inventory b on b.id=a.bed_id where a.id=boarding_movements.allocation_id and a.student_id=boarding_movements.student_id and public.can_manage_boarding_room(b.room_id)));
create policy boarding_announcement_read on public.boarding_announcements for select to authenticated using(public.is_boarding_admin() or (published and (select p.role from public.profiles p where p.id=(select auth.uid()) and p.active) in ('boarding_staff','parent')));
create policy boarding_announcement_admin on public.boarding_announcements for all to authenticated using(public.is_boarding_admin()) with check(public.is_boarding_admin() and created_by=(select auth.uid()));
