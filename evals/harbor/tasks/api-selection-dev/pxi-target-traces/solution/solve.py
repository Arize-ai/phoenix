#!/usr/bin/env python3
"""Distinct traces PXI was asked to debug"""

from harbor_verifiers.phoenix_api import scalar, write_answer

n = scalar("""
select count(distinct json_extract(attributes, '$.metadata.targetTraceId')) from spans
where json_extract(attributes, '$.metadata.targetTraceId') is not null
""")
write_answer(str(n))
