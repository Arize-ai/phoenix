#!/bin/sh
set -eu
exec python -m harbor_verifiers.verify --expected /tests/expected.json
