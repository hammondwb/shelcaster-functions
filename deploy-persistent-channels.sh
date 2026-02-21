#!/bin/bash
# Deploy Persistent IVS Channels Lambda Functions
# This script deploys all Lambda functions for the persistent channels feature

set -e

echo "========================================"
echo "Deploying Persistent Channels Lambdas"
echo "========================================"
echo ""

functions=(
    "shelcaster-create-persistent-channel"
    "shelcaster-assign-channel"
    "shelcaster-unassign-channel"
    "shelcaster-get-host-channel"
    "shelcaster-list-channels"
    "shelcaster-get-channel-stats"
    "shelcaster-get-channel-capacity"
    "shelcaster-update-channel-state"
)

success_count=0
fail_count=0

for function_name in "${functions[@]}"; do
    echo "Deploying $function_name..."
    
    # Create zip file
    zip_file="${function_name}.zip"
    if [ -f "$zip_file" ]; then
        rm "$zip_file"
    fi
    
    cd "$function_name"
    zip -q "../$zip_file" index.mjs
    cd ..
    
    # Update Lambda function code
    if aws lambda update-function-code \
        --function-name "$function_name" \
        --zip-file "fileb://$zip_file" \
        --region us-east-1 > /dev/null 2>&1; then
        echo "✓ $function_name deployed successfully"
        ((success_count++))
    else
        echo "✗ Failed to deploy $function_name"
        ((fail_count++))
    fi
    
    # Clean up zip file
    rm "$zip_file"
    
    echo ""
done

echo "========================================"
echo "Deployment Summary"
echo "========================================"
echo "Successful: $success_count"
echo "Failed: $fail_count"
echo ""

if [ $fail_count -eq 0 ]; then
    echo "All functions deployed successfully!"
else
    echo "Some functions failed to deploy. Check the output above."
fi
