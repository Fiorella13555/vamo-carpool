-- Save provider instructions from the SAME calculation used for the agreed path.
-- Existing trips retain their original route and have map guidance without turns.
alter table public.trips add column navigation_steps jsonb not null default '[]'::jsonb
 check(jsonb_typeof(navigation_steps)='array' and jsonb_array_length(navigation_steps)<=500 and octet_length(navigation_steps::text)<=250000);
-- Existing trip INSERT/SELECT/UPDATE grants and owner RLS apply to this column.
