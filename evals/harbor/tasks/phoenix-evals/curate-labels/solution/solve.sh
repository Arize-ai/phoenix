#!/bin/sh
# Build the grounding-golden dataset from the latest human review on each trace.
set -eu
python /solution/curate_labels.py
