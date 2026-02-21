#!/bin/bash
# Create Lambda functions for Persistent IVS Channels
# This script creates all 8 Lambda functions in AWS

set -e

ROLE_ARN="arn:aws:iam::124355640062:role/lambda-dynamodb-role"
REGION="us-east-1"
RUNTIME="nodejs18.x"

echo "========================================"
echo "Creating Persistent Channel Lambdas"
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

# Create a minimal placeholder zip file
echo "Creating placeholder code..."
mkdir -p temp_lambda
echo 'export const handler = async (event) => { return { statusCode: 200, body: JSON.stringify({ message: "Placeholder" }) }; };' > temp_lambda/index.mjs
cd temp_lambda
zip -q ../placeholder.zip index.mjs
cd ..
rm -rf temp_lambda

success_count=0
fail_count=0

for function_name in "${functions[@]}"; do
    echo "Creating $function_name..."
    
    if aws lambda create-function \
        --function-name "$function_name" \
        --runtime "$RUNTIME" \
        --role "$ROLE_ARN" \
        --handler index.handler \
        --zip-file fileb://placeholder.zip \
        --region "$REGION" \
        --timeout 30 \
        --memory-size 256 > /dev/null 2>&1; then
        echo "✓ $function_name created successfully"
        ((success_count++))
    else
        echo "⚠ $function_name may already exist or failed to create"
        ((fail_count++))
    fi
    echo ""
done

# Clean up placeholder
rm placeholder.zip

echo "========================================"
echo "Creation Summary"
echo "========================================"
echo "Successful: $success_count"
echo "Failed/Existing: $fail_count"
echo ""

if [ $success_count -gt 0 ]; then
    echo "Functions created! Now run:"
    echo "  ./deploy-persistent-channels.sh"
fi
