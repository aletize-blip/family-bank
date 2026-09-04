-- Only needed if you already ran the original schema.sql and set up your database
-- before the kid view-only login feature existed. Run this once in the Supabase
-- SQL Editor. If you're setting up fresh, just use the updated schema.sql instead
-- — you don't need this file.

alter table kids add column if not exists kid_access_code text unique;

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
