#!/bin/bash

# Enable CORS for MediaLive API Gateway Routes
# Run this script to automatically configure CORS

API_ID="td0dn99gi2"
REGION="us-east-1"

echo "🔧 Configuring CORS for API Gateway: $API_ID"
echo ""

# Get all routes
echo "📋 Fetching routes..."
ROUTES=$(aws apigatewayv2 get-routes --api-id $API_ID --region $REGION --query 'Items[*].[RouteId,RouteKey]' --output text)

echo "$ROUTES"
echo ""

# Routes we need to update
declare -a TARGET_ROUTES=(
  "POST /sessions/{sessionId}/streaming/start"
  "POST /sessions/{sessionId}/streaming/stop"
  "POST /sessions/{sessionId}/recording/start"
  "POST /sessions/{sessionId}/recording/stop"
  "POST /shows/{showId}/medialive-channel"
)

echo "🎯 Enabling CORS for MediaLive routes..."
echo ""

# For each target route, find its RouteId and update CORS
for route_key in "${TARGET_ROUTES[@]}"; do
  echo "Processing: $route_key"
  
  # Find the RouteId for this route
  ROUTE_ID=$(echo "$ROUTES" | grep "$route_key" | awk '{print $1}')
  
  if [ -z "$ROUTE_ID" ]; then
    echo "  ⚠️  Route not found, skipping..."
    continue
  fi
  
  echo "  RouteId: $ROUTE_ID"
  
  # Update route to enable CORS
  aws apigatewayv2 update-route \
    --api-id $API_ID \
    --route-id $ROUTE_ID \
    --region $REGION \
    --cors-configuration AllowOrigins='*',AllowHeaders='*',AllowMethods='POST,OPTIONS',MaxAge=300 \
    --output text > /dev/null
  
  if [ $? -eq 0 ]; then
    echo "  ✅ CORS enabled"
  else
    echo "  ❌ Failed to enable CORS"
  fi
  echo ""
done

echo "✨ CORS configuration complete!"
echo ""
echo "Note: Changes are applied immediately (no deployment needed for HTTP API)"
