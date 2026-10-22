-- Security follow-up: rate-limit all public admission lookups, tighten grants,
-- normalize private bucket settings, verify RLS coverage, and audit sensitive writes.

-- The status RPC is callable only from the server-side service client, after the
-- application has applied the same keyed IP rate limit as admission intake.
revoke all on function public.check_admission_status(text,text) from public,anon,authenticated;
grant execute on function public.check_admission_status(text,text) to service_role;
create index if not exists admission_rate_limits_window_idx on private.admission_rate_limits(window_started_at);

-- Earlier migrations granted every current/future public sequence to every
-- authenticated role. Replace that broad grant with usage only for sequences
-- backing records the app actually inserts under RLS.
revoke all privileges on all sequences in schema public from public,anon,authenticated;
grant usage on sequence
 public.announcements_id_seq,
 public.academic_years_id_seq, public.school_terms_id_seq, public.school_classes_id_seq, public.subjects_id_seq,
 public.attendance_records_id_seq, public.fee_invoices_id_seq, public.fee_payments_id_seq, public.boarding_beds_id_seq,
 public.staff_attendance_id_seq,
 public.boarding_buildings_id_seq, public.boarding_dormitories_id_seq, public.boarding_rooms_id_seq,
 public.boarding_bed_inventory_id_seq, public.boarding_staff_assignments_id_seq, public.boarding_allocations_id_seq,
 public.boarding_fee_charges_id_seq, public.boarding_fee_payments_id_seq, public.boarding_roll_call_id_seq,
 public.boarding_movements_id_seq, public.boarding_announcements_id_seq
to authenticated;

-- Profiles may edit only their display name through the normal authenticated
-- API. Role and activation changes remain trusted provisioning operations.
revoke update on public.profiles from authenticated;
grant update(display_name) on public.profiles to authenticated;

-- Reassert private storage settings if a bucket already existed with an unsafe
-- public flag or more permissive upload configuration.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('admission-documents','admission-documents',false,5242880,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['application/pdf','image/jpeg','image/png'];
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('student-photos','student-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

-- Staff may update a roll-call row only while both its old and new student / active
-- allocation pair remain inside their assigned room scope.
drop policy if exists boarding_roll_call_staff_update on public.boarding_roll_call;
create policy boarding_roll_call_staff_update on public.boarding_roll_call for update to authenticated
 using(recorded_by=(select auth.uid()) and exists(
  select 1 from public.boarding_allocations a join public.boarding_bed_inventory b on b.id=a.bed_id
  where a.id=boarding_roll_call.allocation_id and a.student_id=boarding_roll_call.student_id and public.can_manage_boarding_room(b.room_id)))
 with check(recorded_by=(select auth.uid()) and exists(
  select 1 from public.boarding_allocations a join public.boarding_bed_inventory b on b.id=a.bed_id
  where a.id=boarding_roll_call.allocation_id and a.student_id=boarding_roll_call.student_id and public.can_manage_boarding_room(b.room_id)));

-- Keep audit payloads deliberately small: record identity and action metadata,
-- not names, contact details, messages, uploaded paths, or document contents.
create or replace function public.audit_sensitive_write()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_row jsonb; v_old jsonb; v_id text; v_details jsonb;
begin
 v_row:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if tg_op<>'INSERT' then v_old:=to_jsonb(old); end if;
 if tg_table_name='profiles' and tg_op='UPDATE' and v_old->>'role'=v_row->>'role' and v_old->>'active'=v_row->>'active' then return new; end if;
 v_id:=coalesce(v_row->>'id',v_row->>'reference_code',concat_ws(':',v_row->>'student_id',v_row->>'guardian_id'));
 v_details:=jsonb_build_object('operation',lower(tg_op));
 if tg_table_name in ('admission_applications','attendance_records','staff_attendance','boarding_allocations','boarding_roll_call') then
  v_details:=v_details||jsonb_build_object('status',v_row->>'status');
 elsif tg_table_name='profiles' then
  v_details:=v_details||jsonb_build_object('role',v_row->>'role','active',v_row->>'active');
 elsif tg_table_name in ('fee_invoices','fee_payments','boarding_fee_charges','boarding_fee_payments') then
  v_details:=v_details||jsonb_build_object('amount',coalesce(v_row->>'amount',v_row->>'amount_due'));
 elsif tg_table_name='announcements' or tg_table_name='boarding_announcements' then
  v_details:=v_details||jsonb_build_object('published',v_row->>'published');
 elsif tg_table_name='boarding_movements' then
  v_details:=v_details||jsonb_build_object('movement',v_row->>'movement');
 end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
 values((select auth.uid()),lower(tg_table_name)||'.'||lower(tg_op),tg_table_name,v_id,v_details);
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.audit_sensitive_write() from public,anon,authenticated;

create trigger audit_admission_application after insert or update or delete on public.admission_applications for each row execute function public.audit_sensitive_write();
create trigger audit_profile_privilege_change after update of role,active on public.profiles for each row execute function public.audit_sensitive_write();
create trigger audit_school_settings after insert or update or delete on public.school_settings for each row execute function public.audit_sensitive_write();
create trigger audit_school_announcement after insert or update or delete on public.announcements for each row execute function public.audit_sensitive_write();
create trigger audit_school_class after insert or update or delete on public.school_classes for each row execute function public.audit_sensitive_write();
create trigger audit_school_subject after insert or update or delete on public.subjects for each row execute function public.audit_sensitive_write();
create trigger audit_academic_year after insert or update or delete on public.academic_years for each row execute function public.audit_sensitive_write();
create trigger audit_school_term after insert or update or delete on public.school_terms for each row execute function public.audit_sensitive_write();
create trigger audit_guardian after insert or update or delete on public.guardians for each row execute function public.audit_sensitive_write();
create trigger audit_student_guardian after insert or update or delete on public.student_guardians for each row execute function public.audit_sensitive_write();
create trigger audit_student_attendance after insert or update or delete on public.attendance_records for each row execute function public.audit_sensitive_write();
create trigger audit_fee_invoice after insert or update or delete on public.fee_invoices for each row execute function public.audit_sensitive_write();
create trigger audit_fee_payment after insert or update or delete on public.fee_payments for each row execute function public.audit_sensitive_write();
create trigger audit_teacher_profile after insert or update or delete on public.teacher_profiles for each row execute function public.audit_sensitive_write();
create trigger audit_teacher_timetable after insert or update or delete on public.teacher_timetables for each row execute function public.audit_sensitive_write();
create trigger audit_boarding_building after insert or update or delete on public.boarding_buildings for each row execute function public.audit_sensitive_write();
create trigger audit_boarding_dormitory after insert or update or delete on public.boarding_dormitories for each row execute function public.audit_sensitive_write();
create trigger audit_boarding_room after insert or update or delete on public.boarding_rooms for each row execute function public.audit_sensitive_write();
create trigger audit_boarding_bed after insert or update or delete on public.boarding_bed_inventory for each row execute function public.audit_sensitive_write();
create trigger audit_boarding_staff_assignment after insert or update or delete on public.boarding_staff_assignments for each row execute function public.audit_sensitive_write();
create trigger audit_boarding_allocation after insert or update or delete on public.boarding_allocations for each row execute function public.audit_sensitive_write();
create trigger audit_boarding_fee_charge after insert or update or delete on public.boarding_fee_charges for each row execute function public.audit_sensitive_write();
create trigger audit_boarding_fee_payment after insert or update or delete on public.boarding_fee_payments for each row execute function public.audit_sensitive_write();
create trigger audit_boarding_roll_call after insert or update or delete on public.boarding_roll_call for each row execute function public.audit_sensitive_write();
create trigger audit_boarding_movement after insert or update or delete on public.boarding_movements for each row execute function public.audit_sensitive_write();
create trigger audit_boarding_announcement after insert or update or delete on public.boarding_announcements for each row execute function public.audit_sensitive_write();

-- Fail migration rather than silently leave a current private-data table open.
do $$ declare v_table text; begin
 foreach v_table in array array[
  'profiles','announcements','admission_applications','school_events','role_permissions','academic_years','school_terms',
  'school_classes','subjects','students','guardians','student_guardians','attendance_records','fee_invoices','fee_payments',
  'boarding_beds','audit_logs','teacher_profiles','teaching_assignments','teacher_timetables','staff_attendance',
  'boarding_buildings','boarding_dormitories','boarding_rooms','boarding_bed_inventory','boarding_staff_assignments',
  'boarding_allocations','boarding_fee_charges','boarding_fee_payments','boarding_roll_call','boarding_movements','boarding_announcements'
 ] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=v_table and c.relrowsecurity) then
   raise exception 'RLS is not enabled for public.%',v_table;
  end if;
 end loop;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname='admission_rate_limits' and c.relrowsecurity) then raise exception 'RLS is not enabled for private.admission_rate_limits'; end if;
end $$;
