#!/bin/bash

API_ID="td0dn99gi2"
REGION="us-east-1"
ACCOUNT_ID="124355640062"

echo "Adding persistent channels routes to API Gateway: $API_ID"
echo ""

# Function to add a route
add_route() {
    local METHOD=$1
    local PATH=$2
    local FUNCTION=$3
    
    echo "Creating route: $METHOD $PATH -> $FUNCTION"
    
    # Get function ARN
    FUNCTION_ARN=$(aws lambda get-function \
        --function-name $FUNCTION \
        --region $REGION \
        --query 'Configuration.FunctionArn' \
        --output text)
    
    if [ $? -ne 0 ]; then
        echo "  ✗ Failed to get function ARN"
        return 1
    fi
    
    # Create integration
    INTEGRATION_ID=$(aws apigatewayv2 create-integration \
        --api-id $API_ID \
        --integration-type AWS_PROXY \
        --integration-uri $FUNCTION_ARN \
        --payload-format-version 2.0 \
        --region $REGION \
        --query 'IntegrationId' \
        --output text)
    
    if [ $? -ne 0 ]; then
        echo "  ✗ Failed to create integration"
        return 1
    fi
    
    # Create route
    ROUTE_KEY="$METHOD $PATH"
    aws apigatewayv2 create-route \
        --api-id $API_ID \
        --route-key "$ROUTE_KEY" \
        --target "integrations/$INTEGRATION_ID" \
        --region $REGION > /dev/null
    
    if [ $? -ne 0 ]; then
        echo "  ✗ Failed to create route"
        return 1
    fi
    
    # Grant permission
    STATEMENT_ID="apigateway-$FUNCTION-$RANDOM"
    aws lambda add-permission \
        --function-name $FUNCTION \
        --statement-id $STATEMENT_ID \
        --action lambda:InvokeFunction \
        --principal apigateway.amazonaws.com \
        --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$API_ID/*/*" \
        --region $REGION 2>/dev/null > /dev/null
    
    echo "  ✓ Route created successfully"
    return 0
}

# Add all routes
add_route "POST" "/admin/channels" "shelcaster-create-persistent-channel"
add_route "GET" "/admin/channels" "shelcaster-list-channels"
add_route "POST" "/admin/channels/{channelId}/assign" "shelcaster-assign-channel"
add_route "DELETE" "/admin/channels/{channelId}/assign/{hostUserId}" "shelcaster-unassign-channel"
add_route "GET" "/admin/channels/{channelId}/stats" "shelcaster-get-channel-stats"
add_route "PUT" "/admin/channels/{channelId}/state" "shelcaster-update-channel-state"
add_route "GET" "/admin/channels/capacity" "shelcaster-get-channel-capacity"
add_route "GET" "/hosts/{hostUserId}/channel" "shelcaster-get-host-channel"

echo ""
echo "API Base URL: https://$API_ID.execute-api.$REGION.amazonaws.com"
