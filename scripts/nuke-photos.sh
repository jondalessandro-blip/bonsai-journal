#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# nuke-photos.sh  —  wipe all tree photos from storage + database
#
# Usage (run from the workspace root):
#   bash scripts/nuke-photos.sh
#
# The script asks for typed confirmation before sending the request.
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

API_URL="${API_URL:-http://localhost:8080/api}"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              ⚠️  BONSAI PHOTO NUKE SCRIPT ⚠️                 ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  This will:                                                  ║"
echo "║  • Delete ALL photo files from object storage               ║"
echo "║  • Clear photo_url / cover_thumb / cover_position on trees  ║"
echo "║  • Delete ALL rows in tree_photos table                     ║"
echo "║                                                              ║"
echo "║  Trees themselves are NOT deleted.                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

read -r -p "  Type  DELETE PHOTOS  to confirm: " input

if [ "$input" != "DELETE PHOTOS" ]; then
  echo ""
  echo "  ❌  Aborted — confirmation did not match."
  exit 1
fi

echo ""
echo "  Sending request to $API_URL/admin/nuke-photos …"
echo ""

curl -sS \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"confirm":"DELETE PHOTOS"}' \
  "$API_URL/admin/nuke-photos" \
  | python3 -m json.tool 2>/dev/null \
  || cat   # fall back to raw output if python3 json.tool unavailable

echo ""
