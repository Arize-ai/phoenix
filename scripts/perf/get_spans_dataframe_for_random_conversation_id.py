import time

from sqlalchemy import create_engine, text

import phoenix as px
from phoenix.trace.dsl import SpanQuery

stmt = text("""\
SELECT (attributes -> 'metadata' ->> 'conversation_id')
FROM spans TABLESAMPLE SYSTEM (10)
WHERE attributes -> 'metadata' ->> 'conversation_id' IS NOT NULL
LIMIT 1;""")

engine = create_engine("postgresql+psycopg://postgres:phoenix@localhost:5432/postgres")
with engine.connect() as conn:
    conversation_id = conn.execute(stmt).scalar()

print(f"Sampled Conversation ID: {conversation_id}")

condition = f"metadata['conversation_id'] == '{conversation_id}'"

start_time = time.time_ns()
df = px.Client().query_spans(
    SpanQuery().where(condition),
    root_spans_only=True,
    orphan_span_as_root_span=False,
    timeout=300,
)
end_time = time.time_ns()
execution_time = end_time - start_time

print(df[["parent_id", "attributes.metadata"]])
print(f"Execution time: {execution_time / 1e9:.2f} seconds")
