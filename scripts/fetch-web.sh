#!/usr/bin/env bash
# Download the World English Bible (public domain) verse-per-line text from
# eBible.org into cache/web/. The Catholic edition (engwebc) has the
# deuterocanon in Catholic order; engweb (with Apocrypha) is the fallback.
set -euo pipefail
DIR="cache/web"
mkdir -p "$DIR"
if ls "$DIR"/*.txt >/dev/null 2>&1; then
  echo "WEB already present in $DIR"; exit 0
fi
for id in engwebc engweb engwebp; do
  url="https://ebible.org/Scriptures/${id}_vpl.zip"
  echo "Trying $url"
  if curl -fsSL --retry 3 -o "$DIR/web.zip" "$url"; then
    unzip -o -q "$DIR/web.zip" -d "$DIR" && rm -f "$DIR/web.zip"
    echo "Downloaded $id:"; ls -la "$DIR" | head
    exit 0
  fi
done
echo "WARNING: could not download the World English Bible; building without English." >&2
exit 0
