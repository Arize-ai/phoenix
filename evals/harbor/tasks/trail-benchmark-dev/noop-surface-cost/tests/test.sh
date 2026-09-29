#!/bin/sh
set -eu
PYTHONPATH=/opt/verifier exec python -m evals.harbor.verifiers.verify --expected /tests/expected.json
