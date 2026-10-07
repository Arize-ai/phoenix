#!/usr/bin/env python3
"""LLM versus tool time share per project"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select p.name,
       round(100.0 * sum(case when s.span_kind = 'LLM' then s.latency_ms else 0 end) / sum(s.latency_ms), 1) as llm,
       round(100.0 * sum(case when s.span_kind = 'TOOL' then s.latency_ms else 0 end) / sum(s.latency_ms), 1) as tool
from spans s join traces t on t.id = s.trace_rowid join projects p on p.id = t.project_rowid
where p.name in ('pxi_dev', 'pxi_agent_tony')
group by p.name order by p.name
""")
write_answer("; ".join(f"{r['name']} LLM {r['llm']}%, TOOL {r['tool']}%" for r in rows))
