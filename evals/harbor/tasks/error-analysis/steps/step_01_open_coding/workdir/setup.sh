#!/bin/sh
# Harbor runs this task hook in the agent environment before the step's
# agent, so the server is serving the fixture no matter which agent runs.
sh /opt/phoenix-eval/start_phoenix_server.sh
