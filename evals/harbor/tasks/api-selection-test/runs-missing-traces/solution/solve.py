#!/usr/bin/env python3
"""Control: experiment runs with dangling traces"""

from harbor_verifiers.phoenix_api import scalar, write_answer

n = scalar("""
select count(*) from experiment_runs r
where r.trace_id is not null and not exists (select 1 from traces t where t.trace_id = r.trace_id)
""")
write_answer(str(n))
