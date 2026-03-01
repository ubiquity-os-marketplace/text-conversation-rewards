-- Add distribution history tracking for differential reward calculations
-- Issue: https://github.com/ubiquity-os-marketplace/text-conversation-rewards/issues/301

begin;

-- Create distribution_history table to track all reward distributions per issue
create table if not exists public.distribution_history (
  id bigint primary key generated always as identity,
  issue_id bigint not null,
  location_id bigint not null references public.locations(id),
  beneficiary_id bigint not null references public.users(id),
  amount numeric not null default 0,
  payout_mode text not null check (payout_mode in ('transfer', 'permit')),
  transaction_hash text,
  permit_id bigint references public.permits(id),
  distribution_round integer not null default 1,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

-- Index for fast lookup by issue and beneficiary
create index if not exists distribution_history_issue_beneficiary_idx 
  on public.distribution_history (issue_id, beneficiary_id);

-- Index for lookup by location
create index if not exists distribution_history_location_idx 
  on public.distribution_history (location_id);

-- Add comment
comment on table public.distribution_history is 'Tracks all reward distributions per issue for differential calculation';
comment on column public.distribution_history.distribution_round is 'Round number: 1 for initial distribution, 2+ for reopened issue distributions';

-- Function to get total distributed amount for a beneficiary on an issue
create or replace function public.get_total_distributed(
  p_issue_id bigint,
  p_beneficiary_id bigint
) returns numeric
language plpgsql
stable
as $$
declare
  v_total numeric;
begin
  select coalesce(sum(amount), 0)
  into v_total
  from public.distribution_history
  where issue_id = p_issue_id
    and beneficiary_id = p_beneficiary_id;
  
  return v_total;
end;
$$;

-- Function to get the latest distribution round for an issue
create or replace function public.get_latest_distribution_round(
  p_issue_id bigint
) returns integer
language plpgsql
stable
as $$
declare
  v_round integer;
begin
  select coalesce(max(distribution_round), 0)
  into v_round
  from public.distribution_history
  where issue_id = p_issue_id;
  
  return v_round;
end;
$$;

-- Function to insert distribution record with differential calculation
create or replace function public.insert_distribution(
  p_issue_id bigint,
  p_location_id bigint,
  p_beneficiary_id bigint,
  p_new_amount numeric,
  p_payout_mode text,
  p_transaction_hash text default null,
  p_permit_id bigint default null
) returns jsonb
language plpgsql
as $$
declare
  v_previous_total numeric;
  v_difference numeric;
  v_round integer;
  v_result jsonb;
begin
  -- Get previous total distributed amount
  select public.get_total_distributed(p_issue_id, p_beneficiary_id)
  into v_previous_total;
  
  -- Get next distribution round
  select public.get_latest_distribution_round(p_issue_id) + 1
  into v_round;
  
  -- Calculate difference (only positive differences should be processed)
  v_difference := p_new_amount - v_previous_total;
  
  -- Only insert if there's a positive difference
  if v_difference > 0 then
    insert into public.distribution_history (
      issue_id,
      location_id,
      beneficiary_id,
      amount,
      payout_mode,
      transaction_hash,
      permit_id,
      distribution_round
    ) values (
      p_issue_id,
      p_location_id,
      p_beneficiary_id,
      v_difference,
      p_payout_mode,
      p_transaction_hash,
      p_permit_id,
      v_round
    );
    
    v_result := jsonb_build_object(
      'success', true,
      'previous_total', v_previous_total,
      'new_amount', p_new_amount,
      'difference', v_difference,
      'distribution_round', v_round
    );
  else
    v_result := jsonb_build_object(
      'success', false,
      'reason', 'no_positive_difference',
      'previous_total', v_previous_total,
      'new_amount', p_new_amount,
      'difference', v_difference
    );
  end if;
  
  return v_result;
end;
$$;

commit;
