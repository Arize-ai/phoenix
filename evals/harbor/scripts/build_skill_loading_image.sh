#!/usr/bin/env bash
# Builds phoenix-skill-loading:local, the base image for the tasks in tasks/skill-loading/.
# Rerun after changing harbor_verifiers or packages/phoenix-evals.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
context="${repo_root}/evals/harbor/.cache/skill-loading-image"
rm -rf "${context}"
mkdir -p "${context}/wheels"
uv build --wheel --package harbor-verifiers --out-dir "${context}/wheels" --quiet
uv build --wheel "${repo_root}/packages/phoenix-evals" --out-dir "${context}/wheels" --quiet
# Builds for the host's platform. Set SKILL_LOADING_PLATFORM, such as linux/amd64, to override.
docker build \
  ${SKILL_LOADING_PLATFORM:+--platform "${SKILL_LOADING_PLATFORM}"} \
  -t phoenix-skill-loading:local \
  -f "${repo_root}/evals/harbor/environments/skill-loading/Dockerfile" \
  "${context}"
