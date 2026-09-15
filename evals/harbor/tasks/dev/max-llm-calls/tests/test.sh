#!/bin/sh
set -eu
PYTHONPATH=/opt/verifier exec /opt/verifier/bin/python -m evals.harbor.lib.grade --expected /tests/expected.json
