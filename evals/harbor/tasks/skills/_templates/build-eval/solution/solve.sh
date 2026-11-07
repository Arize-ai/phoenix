#!/bin/sh
# Run the bot over support-qa as an experiment with a substring evaluator.
set -eu
cd /app
python3 dev/fake_gateway.py &
gateway=$!
trap 'kill $gateway' EXIT
sleep 2
python3 - <<'EOF'
import sys

sys.path.insert(0, "/app")
from phoenix.client import Client

import support_bot

client = Client(base_url="http://127.0.0.1:6006")
dataset = client.datasets.get_dataset(dataset="support-qa")
bot = support_bot.SupportBot()


def answer(input):
    return bot.answer(input["question"], [])


def contains_expected(output, expected):
    return float(expected["expected"].lower() in str(output).lower())


client.experiments.run_experiment(
    dataset=dataset,
    task=answer,
    evaluators={"contains_expected": contains_expected},
    experiment_name="support-qa-contains-expected",
)
EOF
