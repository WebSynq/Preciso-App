#!/bin/bash
# Test FedEx tracking webhook with valid HMAC signature
# Usage: ./test-tracking-webhook.sh [API_URL]

API_URL="${1:-http://localhost:4000}"
SECRET="${FEDEX_WEBHOOK_SECRET:-test-fedex-secret}"

PAYLOAD='{
  "trackingNumber": "FX123456789",
  "eventType": "delivered",
  "eventTimestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
  "location": "San Diego, CA",
  "details": "Package delivered to front door"
}'

# Compute HMAC-SHA256 signature
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

echo "=== FedEx Tracking Webhook Test ==="
echo "URL: ${API_URL}/webhooks/tracking"
echo "Signature: ${SIGNATURE}"
echo "Payload: ${PAYLOAD}"
echo ""

curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "${API_URL}/webhooks/tracking" \
  -H "Content-Type: application/json" \
  -H "X-FedEx-Signature: ${SIGNATURE}" \
  -d "${PAYLOAD}"

echo ""
echo "=== Done ==="
