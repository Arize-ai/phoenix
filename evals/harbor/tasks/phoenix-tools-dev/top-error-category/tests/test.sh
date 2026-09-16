#!/bin/sh
set -eu
PYTHONPATH=/opt/verifier exec python -m evals.harbor.lib.grade --expected /tests/expected.json
