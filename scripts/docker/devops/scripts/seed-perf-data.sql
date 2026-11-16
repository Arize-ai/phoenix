-- Seed a PostgreSQL Phoenix database with enough spans for query plans to matter.
--
-- The shape is the one that made project pages slow on the hosted online-evals
-- server: several projects ingesting at the same time, so their rows interleave
-- on disk by start time.
--
--   seed-target-app      small, and its newest data is 2 days old
--   seed-busy-app        a busy application
--   seed-evaluator-1..5  five high-volume evaluator trace projects
--
-- At scale 1 this adds 794,000 traces and 1.94 million spans in about a minute.
-- LLM spans carry about 2.5 KB of JSON, and those of the two application
-- projects get two annotations each. Every timestamp is relative to now, so the
-- data sits inside the "last 7 days" window whenever the script runs.
--
-- Run it through the dev script's database container:
--
--   docker exec -i devops-db-1 psql -U postgres -p 5433 -d postgres \
--     -v scale=1 < scripts/seed-perf-data.sql
--
-- It refuses to run twice. To seed again, wipe the database (./dev.sh destroy).

\set ON_ERROR_STOP on
\if :{?scale}
\else
  \set scale 1
\endif
\timing on

create extension if not exists pgcrypto;

do $$
begin
  if exists (select 1 from projects where name = 'seed-busy-app') then
    raise exception 'The seed projects already exist. Wipe the database before seeding again.';
  end if;
end $$;

insert into projects(name) values
  ('seed-target-app'), ('seed-busy-app'),
  ('seed-evaluator-1'), ('seed-evaluator-2'), ('seed-evaluator-3'),
  ('seed-evaluator-4'), ('seed-evaluator-5');

-- p numbers the seed projects 1 to 7, whatever ids the database gave them.
drop table if exists seed_projects;
create unlogged table seed_projects as
select row_number() over (order by name = 'seed-target-app' desc, name = 'seed-busy-app' desc, name)::int as p,
       id
from projects where name like 'seed-%';

-- One row per trace: its project, start time and span count.
drop table if exists seed_traces;
create unlogged table seed_traces as
select row_number() over (order by ts) as rn, p, ts, n from (
  select 1 as p, now() - interval '9 days' + random() * interval '7 days' as ts, 10 as n
    from generate_series(1, 4000 * :scale)
  union all
  select 2, now() - random() * interval '7 days', 10
    from generate_series(1, 40000 * :scale)
  union all
  select p, now() - random() * interval '7 days', 2
    from generate_series(3, 7) as p, generate_series(1, 150000 * :scale)
) s;

-- Traces arrive in time order, so heap order follows start time and the
-- projects interleave.
insert into traces(project_rowid, trace_id, start_time, end_time, last_span_ingested_at)
select sp.id, 'feed' || lpad(to_hex(st.rn), 28, '0'), st.ts,
       st.ts + interval '5 seconds', st.ts + interval '5 seconds'
from seed_traces st join seed_projects sp using (p)
order by st.rn;

drop table if exists seed_spans;
create unlogged table seed_spans as
select t.id as trace_rowid, st.p, k,
       t.start_time + k * interval '200 milliseconds' as start_time,
       'feed' || lpad(to_hex(t.id::bigint * 16 + k), 12, '0') as span_id,
       case when k = 0 then null else 'feed' || lpad(to_hex(t.id::bigint * 16), 12, '0') end as parent_id,
       case when k = 0 then 'CHAIN'
            when (st.p <= 2 and k in (1, 4, 7)) or (st.p > 2 and k = 1) then 'LLM'
            else 'TOOL' end as kind,
       false as has_tools
from seed_traces st
join traces t on t.trace_id = 'feed' || lpad(to_hex(st.rn), 28, '0')
cross join lateral generate_series(0, st.n - 1) as k
order by start_time;

-- Five LLM spans in the target project that used a tool, inside the 7-day
-- window: the rows a selective JSON filter has to find.
update seed_spans set has_tools = true
where ctid in (select ctid from seed_spans
               where p = 1 and kind = 'LLM' and start_time >= now() - interval '7 days'
               order by start_time limit 5);

insert into spans(trace_rowid, span_id, parent_id, name, span_kind, start_time, end_time,
  attributes, events, status_code, status_message, cumulative_error_count,
  cumulative_llm_token_count_prompt, cumulative_llm_token_count_completion,
  llm_token_count_prompt, llm_token_count_completion)
select trace_rowid, span_id, parent_id, kind || '-' || k, kind, start_time,
  start_time + interval '150 milliseconds',
  case
    when kind = 'LLM' and has_tools then jsonb_build_object(
      'openinference', jsonb_build_object('span', jsonb_build_object('kind', 'LLM')),
      'input', jsonb_build_object('value', encode(gen_random_bytes(600), 'hex')),
      'llm', jsonb_build_object(
        'model_name', 'gpt-x',
        'tools', jsonb_build_array(jsonb_build_object('tool', jsonb_build_object('json_schema', '{}'))),
        'output_messages', jsonb_build_array(jsonb_build_object('message', jsonb_build_object(
          'role', 'assistant', 'content', encode(gen_random_bytes(600), 'hex'),
          'tool_calls', jsonb_build_array(jsonb_build_object('tool_call', jsonb_build_object('id', 'c1'))))))))
    when kind = 'LLM' then jsonb_build_object(
      'openinference', jsonb_build_object('span', jsonb_build_object('kind', 'LLM')),
      'input', jsonb_build_object('value', encode(gen_random_bytes(600), 'hex')),
      'llm', jsonb_build_object(
        'model_name', 'gpt-x',
        'output_messages', jsonb_build_array(jsonb_build_object('message', jsonb_build_object(
          'role', 'assistant', 'content', encode(gen_random_bytes(600), 'hex'))))))
    else jsonb_build_object(
      'openinference', jsonb_build_object('span', jsonb_build_object('kind', kind)),
      'input', jsonb_build_object('value', 'q ' || span_id),
      'output', jsonb_build_object('value', 'a ' || span_id))
  end,
  '[]'::jsonb, 'OK', '', 0, 0, 0,
  case when kind = 'LLM' then 10 end, case when kind = 'LLM' then 5 end
from seed_spans
order by start_time;

-- Two annotations on each LLM span of the two application projects, for the
-- annotation summaries and annotation filters.
insert into span_annotations(span_rowid, name, label, score, explanation, metadata,
  annotator_kind, identifier, source, created_at, updated_at)
select s.id, a.name,
       case when random() < 0.7 then 'pass' else 'fail' end,
       round(random()::numeric, 2)::float8, null, '{}'::jsonb,
       'LLM', '', 'API', s.end_time, s.end_time
from spans s
join seed_spans ss on ss.span_id = s.span_id
cross join (values ('seed-correctness'), ('seed-helpfulness')) as a(name)
where ss.p <= 2 and ss.kind = 'LLM';

drop table seed_traces;
drop table seed_spans;
drop table seed_projects;

vacuum analyze traces;
vacuum analyze spans;
vacuum analyze span_annotations;

select p.name, count(distinct t.id) as traces, count(s.id) as spans
from projects p join traces t on t.project_rowid = p.id join spans s on s.trace_rowid = t.id
where p.name like 'seed-%' group by p.name order by p.name;
