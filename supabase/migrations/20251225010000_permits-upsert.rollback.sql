-- WARNING: destructive rollback; only run if no production data has been added to network_id/permit2_address.
begin;

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
drop index if exists permits_partner_nonce_unique;

alter table public.permits
  drop constraint if exists permits_permit2_address_lowercase;

alter table public.permits
  drop column if exists permit2_address,
  drop column if exists network_id;

create unique index if not exists permits_partner_nonce_unique
  on public.permits (partner_id, nonce);

commit;
