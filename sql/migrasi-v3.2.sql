alter table public.jurnal_manuver add column if not exists tanggal_penormalan date;
alter table public.jurnal_manuver add column if not exists dispatcher_20kv text;
alter table public.jurnal_manuver add column if not exists operator_20kv text;

create or replace function public.simpan_jurnal(
  p_id bigint,
  p_header jsonb,
  p_rows jsonb,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_current timestamptz;
  v_updated timestamptz;
begin
  if auth.uid() is null then
    raise exception 'TIDAK_LOGIN' using errcode = '42501';
  end if;

  if p_id is null then
    insert into jurnal_manuver (
      gi_id, tanggal, tanggal_penormalan, hari, keterangan, dispatcher,
      dispatcher_20kv, operator_20kv,
      pengawas_manuver, pengawas_pekerjaan, pengawas_k3, pelaksana_manuver,
      pesan_penutup, teks_final, tahap_penormalan, dibuat_oleh, diubah_oleh, updated_at
    )
    values (
      nullif(p_header->>'gi_id', '')::bigint,
      (p_header->>'tanggal')::date,
      nullif(p_header->>'tanggal_penormalan', '')::date,
      p_header->>'hari',
      p_header->>'keterangan',
      p_header->>'dispatcher',
      p_header->>'dispatcher_20kv',
      p_header->>'operator_20kv',
      p_header->>'pengawas_manuver',
      p_header->>'pengawas_pekerjaan',
      p_header->>'pengawas_k3',
      p_header->>'pelaksana_manuver',
      p_header->>'pesan_penutup',
      p_header->>'teks_final',
      coalesce((p_header->>'tahap_penormalan')::boolean, false),
      p_header->>'user',
      p_header->>'user',
      now()
    )
    returning jurnal_manuver.id, jurnal_manuver.updated_at into v_id, v_updated;
  else
    select jm.updated_at into v_current
    from jurnal_manuver jm
    where jm.id = p_id
    for update;

    if not found then
      raise exception 'JURNAL_TIDAK_ADA' using errcode = 'P0002';
    end if;

    if p_expected_updated_at is not null and v_current is distinct from p_expected_updated_at then
      raise exception 'JURNAL_KONFLIK' using errcode = 'P0001';
    end if;

    update jurnal_manuver jm set
      gi_id = nullif(p_header->>'gi_id', '')::bigint,
      tanggal = (p_header->>'tanggal')::date,
      tanggal_penormalan = nullif(p_header->>'tanggal_penormalan', '')::date,
      hari = p_header->>'hari',
      keterangan = p_header->>'keterangan',
      dispatcher = p_header->>'dispatcher',
      dispatcher_20kv = p_header->>'dispatcher_20kv',
      operator_20kv = p_header->>'operator_20kv',
      pengawas_manuver = p_header->>'pengawas_manuver',
      pengawas_pekerjaan = p_header->>'pengawas_pekerjaan',
      pengawas_k3 = p_header->>'pengawas_k3',
      pelaksana_manuver = p_header->>'pelaksana_manuver',
      pesan_penutup = p_header->>'pesan_penutup',
      teks_final = p_header->>'teks_final',
      tahap_penormalan = coalesce((p_header->>'tahap_penormalan')::boolean, false),
      diubah_oleh = p_header->>'user',
      updated_at = greatest(now(), v_current + interval '1 millisecond')
    where jm.id = p_id
    returning jm.id, jm.updated_at into v_id, v_updated;

    delete from jurnal_manuver_rows r where r.jurnal_id = v_id;
  end if;

  insert into jurnal_manuver_rows (jurnal_id, section, urutan, waktu, peralatan, bay, status)
  select
    v_id,
    x->>'section',
    coalesce((x->>'urutan')::int, 0),
    x->>'waktu',
    x->>'peralatan',
    x->>'bay',
    x->>'status'
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as x;

  return jsonb_build_object('id', v_id, 'updated_at', v_updated);
end;
$$;

revoke all on function public.simpan_jurnal(bigint, jsonb, jsonb, timestamptz) from public;
revoke all on function public.simpan_jurnal(bigint, jsonb, jsonb, timestamptz) from anon;
grant execute on function public.simpan_jurnal(bigint, jsonb, jsonb, timestamptz) to authenticated;

notify pgrst, 'reload schema';
