#!/bin/bash
# Test webhook rejection with invalid HMAC signature
# All three should return 401
# Usage: ./test-invalid-webhook.sh [API_URL]

API_URL="${1:-http://localhost:4000}"

PAYLOAD='{"trackingNumber":"FX000","eventType":"delivered","eventTimestamp":"2024-01-01T00:00:00Z"}'
BAD_SIGNATURE="0000000000000000000000000000000000000000000000000000000000000000"

echo "=== Invalid Webhook Signature Tests ==="
echo ""

echo "--- FedEx (invalid HMAC) ---"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "${API_URL}/webhooks/tracking" \
  -H "Content-Type: application/json" \
  -H "X-FedEx-Signature: ${BAD_SIGNATURE}" \
  -d "${PAYLOAD}"

echo ""
echo "--- Centogene (invalid HMAC) ---"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "${API_URL}/webhooks/lab/centogene" \
  -H "Content-Type: application/json" \
  -H "X-Centogene-Signature: ${BAD_SIGNATURE}" \
  -d "${PAYLOAD}"

echo ""
echo "--- FedEx (missing signature header) ---"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "${API_URL}/webhooks/tracking" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}"

echo ""
echo "=== All should return HTTP 401 ==="
