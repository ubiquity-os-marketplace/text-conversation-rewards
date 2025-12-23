-- Dedupe Permit2 nonces by partner_id + nonce.
-- Assumes a single Permit2 contract and network. If multi-chain/permit2 versions
-- are introduced, add network_id/permit2_address to the key.

create unique index if not exists permits_partner_nonce_unique
  on public.permits (partner_id, nonce)
  where partner_id is not null;

create or replace function public.upsert_permit_max(
  p_amount text,
  p_nonce text,
  p_deadline text,
  p_signature text,
  p_beneficiary_id bigint,
  p_location_id bigint,
  p_token_id bigint,
  p_partner_id bigint
) returns void
language plpgsql
as $$
begin
  insert into public.permits (
    amount,
    nonce,
    deadline,
    signature,
    beneficiary_id,
    location_id,
    token_id,
    partner_id
  ) values (
    p_amount,
    p_nonce,
    p_deadline,
    p_signature,
    p_beneficiary_id,
    p_location_id,
    p_token_id,
    p_partner_id
  )
  on conflict (partner_id, nonce) do update
    set amount = excluded.amount,
        deadline = excluded.deadline,
        signature = excluded.signature,
        beneficiary_id = excluded.beneficiary_id,
        location_id = excluded.location_id,
        token_id = excluded.token_id,
        updated = now()
  where public.permits.transaction is null
    and (public.permits.amount::numeric < excluded.amount::numeric);
end;
$$;
