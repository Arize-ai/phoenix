This script used to print how many traces in our `support-bot` Phoenix project ended in
an error. After a Phoenix upgrade it fails on import. Phoenix runs at
http://127.0.0.1:6006.

```python
import json

import phoenix as px

client = px.Client(endpoint="http://127.0.0.1:6006")
spans = client.get_spans_dataframe(project_name="support-bot")
roots = spans[spans["parent_id"].isna()]
errors = roots[roots["status_code"] == "ERROR"]
print(json.dumps({"error_traces": len(errors)}))
```

Fix it and save it as `/app/error_traces.py`. It should still print one line of JSON in
the same form.
