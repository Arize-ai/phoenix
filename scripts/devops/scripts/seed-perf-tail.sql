-- Give the seeded busy projects fresh traffic: traces from the last few minutes.
--
-- seed-perf-data.sql writes each project's history once. After that, only
-- datagen's projects receive new spans, so a seeded project is soon "pushed out"
-- of the newest spans in the database. That is a real case, but it is not the
-- case of a project that is busy right now. Run this script just before a
-- measurement, with datagen paused, to measure the busy case:
--
--   curl -X PATCH localhost:18273/datagen/api/state -H 'Content-Type: application/json' -d '{"paused": true}'
--   docker exec -i devops-db-1 psql -U postgres -p 5433 -d postgres < scripts/seed-perf-tail.sql
--
-- It adds 2,000 ten-span traces to seed-busy-app and 2,000 two-span traces to
-- each seed-evaluator project (40,000 spans), spread over the last 10 minutes.
-- seed-target-app is left alone: it stays the stale project. The script can be
-- run again; each run uses its own id prefix.

\set ON_ERROR_STOP on
\timing on

do $$
begin
  if not exists (select 1 from projects where name = 'seed-busy-app') then
    raise exception 'Run seed-perf-data.sql first.';
  end if;
end $$;

-- A prefix that differs on every run, so ids never collide: "fee1" + seconds since 2020 in hex.
select 'fee1' || lpad(to_hex((extract(epoch from now()) - 1577836800)::bigint), 8, '0') as prefix \gset

drop table if exists seed_tail;
create unlogged table seed_tail as
select row_number() over (order by ts) as rn, id as project_rowid, ts, n from (
  select p.id, now() - random() * interval '10 minutes' as ts,
         case when p.name = 'seed-busy-app' then 10 else 2 end as n
  from projects p, generate_series(1, 2000)
  where p.name = 'seed-busy-app' or p.name like 'seed-evaluator-%'
) s;

insert into traces(project_rowid, trace_id, start_time, end_time, last_span_ingested_at)
select project_rowid, :'prefix' || lpad(to_hex(rn), 20, '0'), ts, ts + interval '5 seconds', ts + interval '5 seconds'
from seed_tail order by rn;

insert into spans(trace_rowid, span_id, parent_id, name, span_kind, start_time, end_time,
  attributes, events, status_code, status_message, cumulative_error_count,
  cumulative_llm_token_count_prompt, cumulative_llm_token_count_completion,
  llm_token_count_prompt, llm_token_count_completion)
select t.id,
       right(:'prefix', 8) || lpad(to_hex(st.rn * 16 + k), 8, '0'),
       case when k = 0 then null else right(:'prefix', 8) || lpad(to_hex(st.rn * 16), 8, '0') end,
       kind || '-' || k, kind,
       t.start_time + k * interval '200 milliseconds',
       t.start_time + k * interval '200 milliseconds' + interval '150 milliseconds',
       case when kind = 'LLM' then jsonb_build_object(
              'openinference', jsonb_build_object('span', jsonb_build_object('kind', 'LLM')),
              'input', jsonb_build_object('value', encode(gen_random_bytes(600), 'hex')),
              'llm', jsonb_build_object(
                'model_name', 'gpt-x',
                'output_messages', jsonb_build_array(jsonb_build_object('message', jsonb_build_object(
                  'role', 'assistant', 'content', encode(gen_random_bytes(600), 'hex'))))))
            else jsonb_build_object(
              'openinference', jsonb_build_object('span', jsonb_build_object('kind', kind)),
              'input', jsonb_build_object('value', 'q ' || st.rn || '-' || k),
              'output', jsonb_build_object('value', 'a ' || st.rn || '-' || k))
       end,
       '[]'::jsonb, 'OK', '', 0, 0, 0,
       case when kind = 'LLM' then 10 end, case when kind = 'LLM' then 5 end
from seed_tail st
join traces t on t.trace_id = :'prefix' || lpad(to_hex(st.rn), 20, '0')
cross join lateral generate_series(0, st.n - 1) as k
cross join lateral (select case when k = 0 then 'CHAIN'
                                when (st.n = 10 and k in (1, 4, 7)) or (st.n = 2 and k = 1) then 'LLM'
                                else 'TOOL' end as kind) kinds
order by t.start_time, k;

drop table seed_tail;
analyze traces;
analyze spans;

-- Who owns the newest 5,000 spans now?
select p.name, count(*) as of_newest_5000
from (select trace_rowid from spans order by start_time desc limit 5000) s
join traces t on t.id = s.trace_rowid join projects p on p.id = t.project_rowid
group by p.name order by 2 desc;
