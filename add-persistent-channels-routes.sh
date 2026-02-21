#!/bin/bash
# Add API Gateway routes for Persistent IVS Channels
# This script creates HTTP API routes for all persistent channel Lambda functions

set +e  # Continue on errors

API_ID="td0dn99gi2"
REGION="us-east-1"
ACCOUNT_ID="124355640062"

echo "========================================"
echo "Adding Persistent Channels API Routes"
echo "========================================"
echo ""

# Define routes as arrays
declare -a paths=(
    "/admin/channels"
    "/admin/channels"
    "/admin/channels/{channelId}/assign"
    "/admin/channels/{channelId}/assign/{hostUserId}"
    "/admin/channels/{channelId}/stats"
    "/admin/channels/{channelId}/state"
    "/admin/channels/capacity"
    "/hosts/{hostUserId}/channel"
)

declare -a methods=(
    "POST"
    "GET"
    "POST"
    "DELETE"
    "GET"
    "PUT"
    "GET"
    "GET"
)

declare -a functions=(
    "shelcaster-create-persistent-channel"
    "shelcaster-list-channels"
    "shelcaster-assign-channel"
    "shelcaster-unassign-channel"
    "shelcaster-get-channel-stats"
    "shelcaster-update-channel-state"
    "shelcaster-get-channel-capacity"
    "shelcaster-get-host-channel"
)

declare -a descriptions=(
    "Create persistent IVS channel"
    "List all persistent channels"
    "Assign channel to host"
    "Unassign channel from host"
    "Get channel statistics"
    "Update channel state"
    "Get channel capacity info"
    "Get host's assigned channel"
)

success_count=0
fail_count=0

# Loop through routes
for i in "${!paths[@]}"; do
    path="${paths[$i]}"
    method="${methods[$i]}"
    function_name="${functions[$i]}"
    description="${descriptions[$i]}"
    
    echo "Creating route: $method $path"
    echo "  Function: $function_name"
    
    # Get Lambda function ARN
    function_arn=$(aws lambda get-function \
        --function-name "$function_name" \
        --region "$REGION" \
        --query 'Configuration.FunctionArn' \
        --output text 2>&1)
    
    if [ $? -ne 0 ]; then
        echo "  ✗ Failed to get function ARN"
        ((fail_count++))
        echo ""
        continue
    fi
    
    # Create integration
    integration_id=$(aws apigatewayv2 create-integration \
        --api-id "$API_ID" \
        --integration-type AWS_PROXY \
        --integration-uri "$function_arn" \
        --payload-format-version 2.0 \
        --region "$REGION" \
        --query 'IntegrationId' \
        --output text 2>&1)
    
    if [ $? -ne 0 ]; then
        echo "  ✗ Failed to create integration"
        ((fail_count++))
        echo ""
        continue
    fi
    
    # Create route
    route_key="$method $path"
    aws apigatewayv2 create-route \
        --api-id "$API_ID" \
        --route-key "$route_key" \
        --target "integrations/$integration_id" \
        --region "$REGION" > /dev/null 2>&1
    
    if [ $? -ne 0 ]; then
        echo "  ✗ Failed to create route"
        ((fail_count++))
        echo ""
        continue
    fi
    
    # Grant API Gateway permission to invoke Lambda
    statement_id="apigateway-$function_name-$RANDOM"
    aws lambda add-permission \
        --function-name "$function_name" \
        --statement-id "$statement_id" \
        --action lambda:InvokeFunction \
        --principal apigateway.amazonaws.com \
        --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*" \
        --region "$REGION" > /dev/null 2>&1
    
    echo "  ✓ Route created successfully"
    ((success_count++))
    echo ""
done

echo "========================================"
echo "Route Creation Summary"
echo "========================================"
echo "Successful: $success_count"
echo "Failed: $fail_count"
echo ""

if [ $fail_count -eq 0 ]; then
    echo "All routes created successfully!"
    echo ""
    echo "API Base URL: https://$API_ID.execute-api.$REGION.amazonaws.com"
else
    echo "Some routes failed to create. Check the output above."
fi
