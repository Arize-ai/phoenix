#!/bin/bash
set -u
pass() { echo 1 > /logs/verifier/reward.txt; exit 0; }
fail() { echo 0 > /logs/verifier/reward.txt; exit 0; }

[ -f /app/wc.py ] || fail
expected=$(wc -w < /app/sample.txt | tr -d ' ')
actual=$(cd /app && python3 /app/wc.py /app/sample.txt 2>/dev/null | tr -d ' ') || fail
[ "$actual" = "$expected" ] || fail

# Confirm the count is computed from the argument, not hard-coded.
printf 'one two three four five\n' > /tmp/five.txt
alt=$(cd /app && python3 /app/wc.py /tmp/five.txt 2>/dev/null | tr -d ' ') || fail
[ "$alt" = "5" ] && pass
fail
