#!/usr/bin/env bash
# Downloads the full Zomato dataset into ./data (gitignored). The seed falls back
# to the committed fixture if this isn't run, so it's optional — use it to seed
# the full 9,551-row dataset instead of the small sample.
set -euo pipefail

DATA_DIR="$(cd "$(dirname "$0")/.." && pwd)/data"
ZIP="$DATA_DIR/zomato-restaurants-data.zip"
URL="https://www.kaggle.com/api/v1/datasets/download/shrutimehta/zomato-restaurants-data"

mkdir -p "$DATA_DIR"

echo "Downloading dataset from Kaggle..."
if ! curl -fL -o "$ZIP" "$URL"; then
  echo "ERROR: download failed. Kaggle may now require authentication." >&2
  echo "Download manually from https://www.kaggle.com/datasets/shrutimehta/zomato-restaurants-data" >&2
  echo "and unzip zomato.csv + Country-Code.xlsx into: $DATA_DIR" >&2
  exit 1
fi

if ! unzip -tq "$ZIP" >/dev/null 2>&1; then
  echo "ERROR: downloaded file is not a valid zip (Kaggle likely returned a login page)." >&2
  rm -f "$ZIP"
  exit 1
fi

unzip -o "$ZIP" -d "$DATA_DIR"
echo "Done. Files in $DATA_DIR:"
ls -1 "$DATA_DIR"
