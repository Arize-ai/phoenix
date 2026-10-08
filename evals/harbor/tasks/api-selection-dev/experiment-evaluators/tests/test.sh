#!/bin/sh
set -eu
exec python -m api_selection_verifiers.verify --expected /tests/expected.json
