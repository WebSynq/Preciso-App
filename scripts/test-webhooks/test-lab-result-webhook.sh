#!/bin/bash
# Test Centogene lab result webhook with valid HMAC signature
# Usage: ./test-lab-result-webhook.sh [API_URL]

API_URL="${1:-http://localhost:4000}"
SECRET="${CENTOGENE_WEBHOOK_SECRET:-${CENEGENICS_WEBHOOK_SECRET:-test-centogene-secret}}"

PAYLOAD='{
  "orderId": "FS-TEST001",
  "kitBarcode": "KIT-TEST-001",
  "resultStatus": "complete",
  "resultRef": "CG-RESULT-12345",
  "reportUrl": "https://precisoreport.com/results/12345",
  "completedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
  "flaggedValues": []
}'

# Compute HMAC-SHA256 signature
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

echo "=== Centogene Lab Result Webhook Test ==="
echo "URL: ${API_URL}/webhooks/lab/centogene"
echo "Signature: ${SIGNATURE}"
echo "Payload: ${PAYLOAD}"
echo ""

curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "${API_URL}/webhooks/lab/centogene" \
  -H "Content-Type: application/json" \
  -H "X-Centogene-Signature: ${SIGNATURE}" \
  -d "${PAYLOAD}"

echo ""
echo "=== Done ==="
