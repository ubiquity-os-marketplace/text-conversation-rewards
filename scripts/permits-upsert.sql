-- Dedupe Permit2 nonces by partner_id + network_id + permit2_address + nonce.
-- Includes a cleanup step to delete lower-priority duplicates before adding the unique index.

begin;

alter table public.permits
  add column if not exists network_id integer,
  add column if not exists permit2_address text;

update public.permits p
set network_id = t.network
from public.tokens t
where p.network_id is null
  and p.token_id is not null
  and p.token_id = t.id;

-- Permit2 address default (kept in sync with src/types/permit2.ts).
update public.permits
set permit2_address = lower(coalesce(current_setting('app.permit2_address', true), '0xd635918a75356d133d5840ee5c9ed070302c9c60'))
where permit2_address is null
  and partner_id is not null;

with ranked as (
  select
    id,
    row_number() over (
      partition by partner_id, network_id, permit2_address, nonce
      order by (transaction is not null) desc,
               amount::numeric desc,
               created desc,
               id desc
    ) as rn
  from public.permits
  -- Only dedupe rows with full Permit2 metadata; legacy null metadata rows are out of scope.
  where partner_id is not null
    and network_id is not null
    and permit2_address is not null
)
delete from public.permits p
using ranked r
where p.id = r.id
  and r.rn > 1;

drop index if exists permits_partner_nonce_unique;

create unique index if not exists permits_partner_network_permit2_nonce_unique
  on public.permits (partner_id, network_id, permit2_address, nonce);

create or replace function public.upsert_permit_max(
  p_amount text,
  p_nonce text,
  p_deadline text,
  p_signature text,
  p_beneficiary_id bigint,
  p_location_id bigint default null,
  p_token_id bigint default null,
  p_partner_id bigint,
  p_network_id integer,
  p_permit2_address text
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
    permit2_address
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
    lower(p_permit2_address)
  )
  -- Only replace unclaimed permits when the incoming amount is higher.
  on conflict (partner_id, network_id, permit2_address, nonce)
    do update
    set amount = excluded.amount,
        deadline = excluded.deadline,
        signature = excluded.signature,
        beneficiary_id = excluded.beneficiary_id,
        location_id = excluded.location_id,
        token_id = excluded.token_id,
        updated = now()
  where public.permits.transaction is null
    and excluded.amount::numeric > public.permits.amount::numeric;
end;
$$;

commit;
