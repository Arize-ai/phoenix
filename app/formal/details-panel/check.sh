#!/usr/bin/env bash
set -euo pipefail

readonly TLA_VERSION="1.8.0"
readonly TLA_SHA256="cc4803dce2a8ffaf0f5920a9dc39df4b5ee34ab4cb53fb58ac557277a7e516b3"
readonly SPEC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly CACHE_ROOT="${XDG_CACHE_HOME:-${HOME}/.cache}/tlaplus/${TLA_VERSION}"
readonly DEFAULT_TLA2TOOLS_JAR="${CACHE_ROOT}/tla2tools.jar"
readonly TLA2TOOLS_JAR="${TLA2TOOLS_JAR:-${DEFAULT_TLA2TOOLS_JAR}}"

if [[ ! -f "${TLA2TOOLS_JAR}" ]]; then
  mkdir -p "${CACHE_ROOT}"
  curl --fail --location --retry 3 \
    --output "${DEFAULT_TLA2TOOLS_JAR}" \
    "https://github.com/tlaplus/tlaplus/releases/download/v${TLA_VERSION}/tla2tools.jar"
fi

if [[ "${TLA2TOOLS_JAR}" == "${DEFAULT_TLA2TOOLS_JAR}" ]]; then
  actual_sha256="$(shasum -a 256 "${TLA2TOOLS_JAR}" | awk '{print $1}')"
  if [[ "${actual_sha256}" != "${TLA_SHA256}" ]]; then
    echo "TLA+ tools checksum mismatch" >&2
    exit 1
  fi
fi

java_command="${JAVA:-java}"
if ! command -v "${java_command}" >/dev/null 2>&1 ||
  ! "${java_command}" -version >/dev/null 2>&1; then
  if [[ -x /opt/homebrew/opt/openjdk@21/bin/java ]]; then
    java_command=/opt/homebrew/opt/openjdk@21/bin/java
  else
    echo "Java 11 or newer is required to run TLC" >&2
    exit 1
  fi
fi

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/details-panel-tlc.XXXXXX")"
trap 'rm -rf "${work_dir}"' EXIT

cd "${SPEC_DIR}"

"${java_command}" -XX:+UseParallelGC -jar "${TLA2TOOLS_JAR}" \
  -cleanup \
  -config Fixed \
  -metadir "${work_dir}/fixed" \
  -noGenerateSpecTE \
  DetailsPanelPersistence

set +e
legacy_output="$("${java_command}" -XX:+UseParallelGC -jar "${TLA2TOOLS_JAR}" \
  -cleanup \
  -config Legacy \
  -metadir "${work_dir}/legacy" \
  -noGenerateSpecTE \
  DetailsPanelPersistence 2>&1)"
legacy_status=$?
set -e

if [[ ${legacy_status} -eq 0 ]]; then
  echo "Legacy delayed persistence unexpectedly satisfied Safety" >&2
  exit 1
fi

if [[ "${legacy_output}" != *"Invariant Safety is violated"* ]]; then
  echo "Legacy model failed without the expected Safety counterexample" >&2
  echo "${legacy_output}" >&2
  exit 1
fi

echo "TLC model-checked the close persistence barrier with synchronous or delayed release and found the required unguarded-close counterexample."
