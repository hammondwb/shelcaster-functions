#!/bin/bash
# Create Lambda functions for Persistent IVS Channels (without zip)
# This script creates all 8 Lambda functions in AWS using inline code

set +e

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

success_count=0
fail_count=0

for function_name in "${functions[@]}"; do
    echo "Creating $function_name..."
    
    # Create function with inline code (will be replaced by deploy script)
    result=$(aws lambda create-function \
        --function-name "$function_name" \
        --runtime "$RUNTIME" \
        --role "$ROLE_ARN" \
        --handler index.handler \
        --zip-file fileb://<(echo 'UEsDBAoAAAAAAKRReFkAAAAAAAAAAAAAAAAGABwAaW5kZXgubWpzVVQJAAOqxBRnqsQUZ3V4CwABBOgDAAAE6AMAAFBLAQIeAwoAAAAAAKRReFkAAAAAAAAAAAAAAAAGABgAAAAAAAAAAAC0gQAAAABpbmRleC5tanNVVAUAA6rEFGd1eAsAAQToAwAABOgDAABQSwUGAAAAAAEAAQBMAAAAQAAAAAAA' | base64 -d) \
        --region "$REGION" \
        --timeout 30 \
        --memory-size 256 2>&1)
    
    if echo "$result" | grep -q "FunctionArn"; then
        echo "✓ $function_name created successfully"
        ((success_count++))
    elif echo "$result" | grep -q "ResourceConflictException"; then
        echo "⚠ $function_name already exists"
    else
        echo "✗ Failed to create $function_name"
        ((fail_count++))
    fi
    echo ""
done

echo "========================================"
echo "Creation Summary"
echo "========================================"
echo "Successful: $success_count"
echo "Already Exist/Failed: $fail_count"
echo ""

if [ $success_count -gt 0 ]; then
    echo "Functions created! Now run:"
    echo "  ./deploy-persistent-channels.sh"
fi
