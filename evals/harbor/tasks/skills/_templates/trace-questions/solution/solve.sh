#!/bin/sh
# Answer from the project's root spans with the Phoenix client.
set -eu
python3 - <<'EOF'
import json

from harbor_verifiers import phoenix_api

roots = [s for s in phoenix_api.project_spans("support-bot") if not s.get("parent_id")]
errored = [s for s in roots if s["status_code"] == "ERROR"]
error_type = errored[0]["events"][0]["attributes"]["exception.type"]
answer = {"error_trace_count": len(errored), "error_type": error_type}
with open("/app/answer.json", "w") as f:
    json.dump(answer, f)
print(answer)
EOF
