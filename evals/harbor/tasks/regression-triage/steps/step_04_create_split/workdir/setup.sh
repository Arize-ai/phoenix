#!/bin/sh
# Harbor runs this task hook in the agent environment before the step's
# agent, so the fixtures exist no matter which agent (or oracle) runs.
python /opt/phoenix-eval/fetch_fixtures.py --task regression-triage
