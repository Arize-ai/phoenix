#!/bin/sh
# Port the script from the removed phoenix.Client to phoenix.client.Client.
set -eu
cat > /app/error_traces.py <<'EOF'
import json

from phoenix.client import Client

client = Client(base_url="http://127.0.0.1:6006")
spans = client.spans.get_spans_dataframe(
    project_identifier="support-bot", root_spans_only=True, limit=100_000
)
errors = spans[spans["status_code"] == "ERROR"]
print(json.dumps({"error_traces": len(errors)}))
EOF
