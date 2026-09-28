#!/bin/sh
# Reward Kit is preinstalled in the image because the sandbox has no route to PyPI.
# LITELLM_LOCAL_MODEL_COST_MAP keeps litellm from fetching its model cost map from GitHub,
# which the allowlist blocks.
set -eu
python /tests/reply.py
LITELLM_LOCAL_MODEL_COST_MAP=True exec python -m rewardkit /tests
