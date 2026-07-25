#!/bin/zsh
# Live view of the whole purchase→compile→delivery pipeline during a manual test.
#
#   scripts/watch-pipeline.sh          # follow everything (ctrl-C to stop)
#   scripts/watch-pipeline.sh status   # one-shot snapshot, no follow
#
# Panes, merged into one stream:
#   [server]  al-ai-fx container — [pipeline] stage lines + [Mail]/[TestActivate]
#   [daemon]  Windows VPS compile daemon log
#   [db]      Compilation rows, refreshed every 10s
SERVER=root@65.108.121.172
KEY=~/.ssh/coolify_vps_ed25519
VPS=root@46.105.41.30            # Windows compile worker (SSH)
PG='docker ps --format "{{.Names}}" | grep wg00wkoc8kcs0g804sckck4o | head -1'
APP='docker ps --format "{{.Names}}" | grep jwsc0g04w4w04ksc480ocgko | head -1'

snapshot() {
  echo "── compilations ─────────────────────────────────────────"
  ssh -i $KEY $SERVER "PGC=\$($PG); docker exec \$PGC psql -U alaifx -d alaifx -c \
    \"SELECT c.id, r.slug, c.status, c.\\\"attemptCount\\\" AS tries, c.\\\"sizeBytes\\\" AS bytes, \
      c.\\\"errorMessage\\\", c.\\\"createdAt\\\" \
      FROM \\\"Compilation\\\" c JOIN \\\"Robot\\\" r ON r.id=c.\\\"robotId\\\" \
      ORDER BY c.\\\"createdAt\\\" DESC LIMIT 5;\""
  echo "── subscriptions ────────────────────────────────────────"
  ssh -i $KEY $SERVER "PGC=\$($PG); docker exec \$PGC psql -U alaifx -d alaifx -c \
    \"SELECT s.id, u.email, r.slug, s.tier, s.status, s.\\\"mt5AccountNumber\\\" AS mt5, s.\\\"expiresAt\\\" \
      FROM \\\"Subscription\\\" s JOIN \\\"User\\\" u ON u.id=s.\\\"userId\\\" \
      JOIN \\\"Robot\\\" r ON r.id=s.\\\"robotId\\\" ORDER BY s.\\\"createdAt\\\" DESC LIMIT 5;\""
  echo "── daemon heartbeat ─────────────────────────────────────"
  ssh -i $KEY $SERVER "PGC=\$($PG); docker exec \$PGC psql -U alaifx -d alaifx -c \
    \"SELECT id, \\\"lastSeenAt\\\", now()-\\\"lastSeenAt\\\" AS age FROM \\\"WorkerHeartbeat\\\";\""
}

if [[ "${1:-}" == "status" ]]; then
  snapshot
  exit 0
fi

snapshot
echo ""
echo "following logs — ctrl-C to stop"
echo ""

ssh -i $KEY $SERVER "APPC=\$($APP); docker logs -f --since 1m \$APPC 2>&1" \
  | grep --line-buffered -E "\[pipeline\]|\[Mail\]|\[TestActivate\]|\[Subscription|error|Error" \
  | sed -u 's/^/[server] /' &

ssh $VPS "powershell -Command \"Get-Content C:\autocompiler\daemon.log -Tail 5 -Wait\"" 2>/dev/null \
  | sed -u 's/^/[daemon] /' &

while true; do
  sleep 10
  ssh -i $KEY $SERVER "PGC=\$($PG); docker exec \$PGC psql -U alaifx -d alaifx -t -c \
    \"SELECT c.status || ' ' || coalesce(c.\\\"sizeBytes\\\"::text,'-') || 'B tries=' || c.\\\"attemptCount\\\" \
      FROM \\\"Compilation\\\" c ORDER BY c.\\\"createdAt\\\" DESC LIMIT 1;\"" 2>/dev/null \
    | tr -d ' \n' | sed 's/^/[db] latest job: /' && echo ""
done &

trap 'kill $(jobs -p) 2>/dev/null' INT TERM
wait
