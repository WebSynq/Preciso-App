#!/bin/bash
# Test Cenegenics lab result webhook with valid HMAC signature
# Usage: ./test-lab-result-webhook.sh [API_URL]

API_URL="${1:-http://localhost:4000}"
SECRET="${CENEGENICS_WEBHOOK_SECRET:-test-cenegenics-secret}"

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

echo "=== Cenegenics Lab Result Webhook Test ==="
echo "URL: ${API_URL}/webhooks/lab/cenegenics"
echo "Signature: ${SIGNATURE}"
echo "Payload: ${PAYLOAD}"
echo ""

curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "${API_URL}/webhooks/lab/cenegenics" \
  -H "Content-Type: application/json" \
  -H "X-Cenegenics-Signature: ${SIGNATURE}" \
  -d "${PAYLOAD}"

echo ""
echo "=== Done ==="
