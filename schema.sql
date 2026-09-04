-- Run this in Supabase: Project > SQL Editor > New query > paste all > Run

create table if not exists kids (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null default auth.uid(),
  name text not null,
  balance numeric not null default 0,
  interest_rate numeric not null default 0, -- annual percent, e.g. 5 = 5%/year
  kid_access_code text unique, -- short code the kid uses for view-only access, no password needed
  created_at timestamptz default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references kids(id) on delete cascade,
  amount numeric not null, -- positive = deposit, negative = withdrawal
  note text,
  type text not null default 'manual', -- 'manual' or 'interest'
  created_at timestamptz default now()
);

alter table kids enable row level security;
alter table transactions enable row level security;

create policy "Parents manage their own kids"
  on kids for all
  using (auth.uid() = parent_id)
  with check (auth.uid() = parent_id);

create policy "Parents manage transactions for their kids"
  on transactions for all
  using (exists (select 1 from kids where kids.id = transactions.kid_id and kids.parent_id = auth.uid()))
  with check (exists (select 1 from kids where kids.id = transactions.kid_id and kids.parent_id = auth.uid()));

-- Keep kids.balance in sync automatically whenever a transaction is inserted
create or replace function update_kid_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update kids set balance = balance + new.amount where id = new.kid_id;
  return new;
end;
$$;

drop trigger if exists on_transaction_insert on transactions;
create trigger on_transaction_insert
  after insert on transactions
  for each row execute function update_kid_balance();

-- Kid-facing view-only access: no login account needed, just their access code.
-- This function is the ONLY way the anon (kid) role can read data — it only
-- returns the one matching kid's info, and there is no equivalent write function,
-- so kids can view but never change anything.
create or replace function get_kid_view(code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  kid_record kids;
  result json;
begin
  select * into kid_record from kids where kid_access_code = code;
  if kid_record.id is null then
    return null;
  end if;

  select json_build_object(
    'name', kid_record.name,
    'balance', kid_record.balance,
    'interest_rate', kid_record.interest_rate,
    'transactions', (
      select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json)
      from (select amount, note, type, created_at from transactions where kid_id = kid_record.id) t
    )
  ) into result;

  return result;
end;
$$;

grant execute on function get_kid_view(text) to anon;
