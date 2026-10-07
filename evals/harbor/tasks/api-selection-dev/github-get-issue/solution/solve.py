#!/usr/bin/env python3
"""Count examples expecting one tool"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

row = execute_sql("""
select sum(case when json_extract(r.output, '$.expected_tool') = 'get_github_issue' then 1 else 0 end) as n, count(*) as total
from dataset_example_revisions r join dataset_examples e on e.id = r.dataset_example_id
join datasets d on d.id = e.dataset_id
where d.name = 'github-support-triage-tool-routing'
and r.id in (select max(id) from dataset_example_revisions group by dataset_example_id)
""")[0]
write_answer(f"{row['n']} of {row['total']}")
