-- Track each reward distribution so reopened issues can pay only the positive delta.
begin;

alter table public.permits
  add column if not exists payout_mode text,
  add column if not exists distribution_run_id text;

alter table public.permits
  drop constraint if exists permits_payout_mode_check;

alter table public.permits
  add constraint permits_payout_mode_check
  check (payout_mode is null or payout_mode in ('transfer', 'permit', 'xp'));

create index if not exists permits_distribution_history_lookup
  on public.permits (location_id, token_id, network_id, beneficiary_id);

drop function if exists public.upsert_permit_max(
  text,
  text,
  text,
  text,
  bigint,
  bigint,
  bigint,
  bigint,
  integer,
  text
);

drop index if exists permits_partner_network_permit2_nonce_unique;

create unique index if not exists permits_partner_network_permit2_nonce_beneficiary_run_unique
  on public.permits (partner_id, network_id, permit2_address, nonce, beneficiary_id, distribution_run_id)
  where distribution_run_id is not null;

create or replace function public.upsert_permit_max(
  p_amount text,
  p_nonce text,
  p_deadline text,
  p_signature text,
  p_beneficiary_id bigint,
  p_location_id bigint default null,
  p_token_id bigint default null,
  p_partner_id bigint default null,
  p_network_id integer default null,
  p_permit2_address text default null,
  p_payout_mode text default null,
  p_distribution_run_id text default null
) returns void
language plpgsql
as $$
begin
  if p_partner_id is null then
    raise exception 'p_partner_id is required';
  end if;

  if p_network_id is null then
    raise exception 'p_network_id is required';
  end if;

  if p_permit2_address is null then
    raise exception 'p_permit2_address is required';
  end if;

  insert into public.permits (
    amount,
    nonce,
    deadline,
    signature,
    beneficiary_id,
    location_id,
    token_id,
    partner_id,
    network_id,
    permit2_address,
    payout_mode,
    distribution_run_id
  ) values (
    p_amount,
    p_nonce,
    p_deadline,
    p_signature,
    p_beneficiary_id,
    p_location_id,
    p_token_id,
    p_partner_id,
    p_network_id,
    lower(p_permit2_address),
    p_payout_mode,
    p_distribution_run_id
  )
  on conflict (partner_id, network_id, permit2_address, nonce, beneficiary_id, distribution_run_id)
    where distribution_run_id is not null
    do update
    set amount = excluded.amount,
        deadline = excluded.deadline,
        signature = excluded.signature,
        beneficiary_id = excluded.beneficiary_id,
        location_id = excluded.location_id,
        token_id = excluded.token_id,
        payout_mode = excluded.payout_mode,
        distribution_run_id = excluded.distribution_run_id,
        updated = now()
  where public.permits.transaction is null
    and excluded.amount::numeric > public.permits.amount::numeric;
end;
$$;

commit;
