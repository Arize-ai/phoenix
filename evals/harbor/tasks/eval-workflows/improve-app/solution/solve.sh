#!/bin/sh
# Save the reference prompt as a new `support-system` version and run it as an experiment.
set -eu
cd /app && python /solution/improve_prompt.py
