#!/bin/bash
set -u
pass() { echo 1 > /logs/verifier/reward.txt; exit 0; }
fail() { echo 0 > /logs/verifier/reward.txt; exit 0; }

[ -f /app/wc.py ] || fail

# The plain count must still work.
expected=$(wc -w < /app/sample.txt | tr -d ' ')
actual=$(cd /app && python3 /app/wc.py /app/sample.txt 2>/dev/null | tr -d ' ') || fail
[ "$actual" = "$expected" ] || fail

actual_top=$(cd /app && python3 /app/wc.py --top 3 /app/sample.txt 2>/dev/null) || fail
[ "$actual_top" = "$(cat /tests/expected_top3.txt)" ] || fail

# Tie-breaking and punctuation handling on a second input.
printf 'Beta, alpha! beta alpha gamma. GAMMA delta\n' > /tmp/tie.txt
alt=$(cd /app && python3 /app/wc.py --top 2 /tmp/tie.txt 2>/dev/null) || fail
[ "$alt" = "$(printf 'alpha 2\nbeta 2')" ] && pass
fail
