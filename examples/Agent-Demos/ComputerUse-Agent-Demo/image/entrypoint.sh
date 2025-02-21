#!/bin/bash
set -e

./start_all.sh
./novnc_startup.sh

python http_server.py > /tmp/server_logs.txt 2>&1 &

python computer_use_agent/app.py > /tmp/gradio_stdout.log 2>&1 &

echo "✨ Computer Use Agent is ready!"
echo "➡️  Open http://localhost:8080 in your browser to begin"

# Keep the container running
tail -f /dev/null
