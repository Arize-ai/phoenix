#!/bin/sh
# Harbor runs this task hook in the agent environment before the step's
# agent, so seed data exists no matter which agent (or oracle) runs.
sh /opt/phoenix-eval/bootstrap_data.sh
