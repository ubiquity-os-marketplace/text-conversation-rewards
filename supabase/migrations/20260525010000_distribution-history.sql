-- Track every generated payout distribution so reopened issues can pay only
-- positive reward differences while preserving an audit trail.
begin;

create table if not exists public.distribution_history (
  id bigserial primary key,
  amount text not null,
  beneficiary_id bigint not null references public.users(id),
  location_id bigint references public.locations(id) on delete set null,
  network_id integer,
  nonce text not null,
  partner_id bigint references public.partners(id) on delete set null,
  payout_mode text not null check (payout_mode in ('permit', 'transfer')),
  permit2_address text,
  token_id bigint references public.tokens(id) on delete set null,
  transaction text,
  created timestamptz not null default now()
);

create unique index if not exists distribution_history_unique_distribution
  on public.distribution_history (
    partner_id,
    network_id,
    permit2_address,
    nonce,
    beneficiary_id,
    payout_mode
  );

create index if not exists distribution_history_location_idx
  on public.distribution_history(location_id);

create index if not exists distribution_history_beneficiary_idx
  on public.distribution_history(beneficiary_id);

commit;
