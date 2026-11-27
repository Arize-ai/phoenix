#!/usr/bin/env bash
# Uploads social post media to the public arize-phoenix-assets bucket and prints each public URL.
#
#   stage-media.sh <YYYY-MM-DD>-<slug> <file> [<file> ...]
#
# Files land at gs://arize-phoenix-assets/social/<folder>/<basename>. Existing objects are never
# overwritten; rename the file to publish a new version.
set -euo pipefail

BUCKET="arize-phoenix-assets"
PREFIX="social"

if [[ $# -lt 2 ]]; then
  echo "usage: $(basename "$0") <YYYY-MM-DD>-<slug> <file> [<file> ...]" >&2
  exit 2
fi

folder="$1"
shift
if [[ ! "$folder" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "folder must look like 2026-11-18-prompt-tags (date, then a kebab-case slug)" >&2
  exit 2
fi

for file in "$@"; do
  [[ -f "$file" ]] || { echo "not a file: $file" >&2; exit 2; }
  name="$(basename "$file")"
  if [[ ! "$name" =~ ^[a-z0-9]+([-.][a-z0-9]+)*\.(png|jpg|jpeg|gif|webp|mp4|mov|pdf)$ ]]; then
    echo "use a lowercase kebab-case name with a png, jpg, gif, webp, mp4, mov, or pdf extension: $name" >&2
    exit 2
  fi
done

for file in "$@"; do
  name="$(basename "$file")"
  dest="gs://${BUCKET}/${PREFIX}/${folder}/${name}"
  if gcloud storage objects describe "$dest" >/dev/null 2>&1; then
    echo "exists, skipped: https://storage.googleapis.com/${BUCKET}/${PREFIX}/${folder}/${name}" >&2
    continue
  fi
  if ! log="$(gcloud storage cp "$file" "$dest" --no-clobber --cache-control="public, max-age=86400" 2>&1)"; then
    echo "$log" >&2
    exit 1
  fi
  echo "https://storage.googleapis.com/${BUCKET}/${PREFIX}/${folder}/${name}"
done
