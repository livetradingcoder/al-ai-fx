#!/bin/zsh
# Release a robot source version to the platform's encrypted storage.
#   scripts/release-robot.sh <slug> <version>
# Uses robots/<slug>/MASTER.mq5. Steps:
#   1. contract check   2. freeze copy + sha256 under releases/v<N>/
#   3. scp to Hetzner box, docker cp into the al-ai-fx container
#   4. run scripts/upload-robot-source.js inside the container
# After success: bump Robot.sourceVersion in the DB (printed at the end) —
# new compile jobs then pull the new version. Old versions stay immutable.
set -euo pipefail
SLUG="$1"; VER="$2"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/robots/$SLUG/MASTER.mq5"
REL="$ROOT/robots/$SLUG/releases/v$VER"
SSH_KEY="$HOME/.ssh/coolify_vps_ed25519"
SERVER="root@65.108.121.172"

[ -f "$SRC" ] || { echo "no MASTER.mq5 for $SLUG"; exit 1 }
[ -d "$REL" ] && { echo "v$VER already exists — versions are immutable, pick v$((VER+1))"; exit 1 }

node "$ROOT/scripts/check-robot-source.js" "$SRC"

mkdir -p "$REL"
cp "$SRC" "$REL/$SLUG-v$VER.mq5"
shasum -a 256 "$REL/$SLUG-v$VER.mq5" | cut -d' ' -f1 > "$REL/sha256.txt"
echo "frozen: $REL/$SLUG-v$VER.mq5 ($(cat $REL/sha256.txt | head -c 12)…)"

scp -i "$SSH_KEY" -q "$REL/$SLUG-v$VER.mq5" "$SERVER:/tmp/$SLUG-v$VER.mq5"
ssh -i "$SSH_KEY" "$SERVER" "APP=\$(docker ps --format '{{.Names}}' | grep jwsc0g04w4w04ksc480ocgko | head -1); \
  docker cp /tmp/$SLUG-v$VER.mq5 \$APP:/tmp/src.mq5 && rm /tmp/$SLUG-v$VER.mq5 && \
  docker exec \$APP node /app/scripts/upload-robot-source.js $SLUG /tmp/src.mq5 $VER && \
  docker exec \$APP rm /tmp/src.mq5"

echo ""
echo "Uploaded sources/$SLUG/v$VER.mq5.enc"
echo "To activate for new compiles:"
echo "  UPDATE \"Robot\" SET \"sourceVersion\"=$VER WHERE slug='$SLUG';"
