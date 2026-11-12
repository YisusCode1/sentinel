#!/usr/bin/env bash
# Usage: SENTINEL_API_KEY=... POLICY_ID=... ./scripts/demo_onchain.sh <recipient> <amount_near>
set -euo pipefail
API=${SENTINEL_API_URL:-http://localhost:8001}
NETWORK=${SENTINEL_NETWORK:-near}
VAULT=${VAULT_ACCOUNT:-sentinel-vault-ia.testnet}
AGENT=${AGENT_ACCOUNT:-sentinel-agent-ia.testnet}
RECIPIENT=$1
AMOUNT=$2
YOCTO=$(python3 -c "from decimal import Decimal; import sys; print(int(Decimal(sys.argv[1])*10**24))" "$AMOUNT")

echo "1) Sentinel evaluates (deterministic Policy Engine + AI advisory)..."
RESP=$(curl -s -X POST "$API/api/v1/operations/evaluate" \
  -H "Content-Type: application/json" -H "X-API-Key: $SENTINEL_API_KEY" \
  -d "{\"policy_id\":\"$POLICY_ID\",\"network\":\"$NETWORK\",\"operation\":\"transfer\",\"token\":\"NEAR\",\"amount\":\"$AMOUNT\",\"recipient\":\"$RECIPIENT\"}")
echo "$RESP" | python3 -m json.tool
DECISION=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('decision','error'))")

if [ "$DECISION" != "approved" ]; then
  echo "Sentinel decision: $DECISION -> no on-chain call."
  exit 0
fi

echo "2) Approved off-chain. The agent now asks the vault (limits enforced on-chain)..."
near contract call-function as-transaction "$VAULT" request_transfer \
  json-args "{\"recipient\":\"$RECIPIENT\",\"amount\":\"$YOCTO\"}" \
  prepaid-gas '30 Tgas' attached-deposit '0 NEAR' \
  sign-as "$AGENT" network-config testnet sign-with-keychain send \
  || echo "The vault rejected the transfer on-chain."
