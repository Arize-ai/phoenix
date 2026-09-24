#!/bin/sh
# Reward Kit is preinstalled in the image because the sandbox has no route to PyPI.
# litellm otherwise retries a GitHub fetch of its model cost map that the allowlist blocks.
set -eu
export PYTHONPATH=/opt/verifier LITELLM_LOCAL_MODEL_COST_MAP=True
exec python -m rewardkit /tests
