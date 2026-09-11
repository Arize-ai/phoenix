#!/bin/bash
set -u
pass() { echo 1 > /logs/verifier/reward.txt; exit 0; }
fail() { echo 0 > /logs/verifier/reward.txt; exit 0; }

[ -f /app/README.md ] || fail
grep -qF 'wc.py' /app/README.md || fail
grep -qF -- '--top' /app/README.md || fail
grep -qF 'python3' /app/README.md && pass
fail
