#!/bin/bash
# Check Persistent Channels Setup
# This script verifies that all prerequisites are in place before testing

set +e  # Continue on errors

echo "========================================"
echo "Checking Persistent Channels Setup"
echo "========================================"
echo ""

all_good=true

# Check 1: AWS CLI installed
echo "1. Checking AWS CLI..."
if command -v aws &> /dev/null; then
    aws_version=$(aws --version 2>&1)
    echo "   ✓ AWS CLI installed: $aws_version"
else
    echo "   ✗ AWS CLI not found. Please install AWS CLI."
    all_good=false
fi
echo ""

# Check 2: AWS credentials configured
echo "2. Checking AWS credentials..."
if aws sts get-caller-identity &> /dev/null; then
    identity=$(aws sts get-caller-identity 2>&1)
    account=$(echo "$identity" | grep -o '"Account": "[^"]*"' | cut -d'"' -f4)
    arn=$(echo "$identity" | grep -o '"Arn": "[^"]*"' | cut -d'"' -f4)
    echo "   ✓ AWS credentials configured"
    echo "     Account: $account"
    echo "     User: $arn"
else
    echo "   ✗ AWS credentials not configured. Run 'aws configure'"
    all_good=false
fi
echo ""

# Check 3: DynamoDB table exists
echo "3. Checking DynamoDB table..."
if aws dynamodb describe-table --table-name shelcaster-app --region us-east-1 &> /dev/null; then
    table_status=$(aws dynamodb describe-table --table-name shelcaster-app --region us-east-1 --query 'Table.TableStatus' --output text)
    echo "   ✓ Table 'shelcaster-app' exists"
    echo "     Status: $table_status"
else
    echo "   ✗ Table 'shelcaster-app' not found"
    all_good=false
fi
echo ""

# Check 4: DynamoDB GSI exists
echo "4. Checking DynamoDB GSI..."
gsi_check=$(aws dynamodb describe-table --table-name shelcaster-app --region us-east-1 --query "Table.GlobalSecondaryIndexes[?IndexName=='entityType-index'].IndexName" --output text 2>&1)
if [ "$gsi_check" == "entityType-index" ]; then
    gsi_status=$(aws dynamodb describe-table --table-name shelcaster-app --region us-east-1 --query "Table.GlobalSecondaryIndexes[?IndexName=='entityType-index'].IndexStatus" --output text)
    echo "   ✓ GSI 'entityType-index' exists"
    echo "     Status: $gsi_status"
else
    echo "   ✗ GSI 'entityType-index' not found"
    echo "     Create it with:"
    echo "     aws dynamodb update-table --table-name shelcaster-app --attribute-definitions AttributeName=entityType,AttributeType=S --global-secondary-index-updates '[{\"Create\":{\"IndexName\":\"entityType-index\",\"KeySchema\":[{\"AttributeName\":\"entityType\",\"KeyType\":\"HASH\"}],\"Projection\":{\"ProjectionType\":\"ALL\"},\"ProvisionedThroughput\":{\"ReadCapacityUnits\":5,\"WriteCapacityUnits\":5}}}]'"
    all_good=false
fi
echo ""

# Check 5: Lambda functions exist
echo "5. Checking Lambda functions..."
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

existing_functions=0
missing_functions=()

for func in "${functions[@]}"; do
    if aws lambda get-function --function-name "$func" --region us-east-1 &> /dev/null; then
        ((existing_functions++))
    else
        missing_functions+=("$func")
    fi
done

if [ $existing_functions -eq ${#functions[@]} ]; then
    echo "   ✓ All ${#functions[@]} Lambda functions exist"
else
    echo "   ⚠ Only $existing_functions/${#functions[@]} Lambda functions exist"
    echo "     Missing functions:"
    for func in "${missing_functions[@]}"; do
        echo "       - $func"
    done
    echo "     You need to create these functions in AWS Lambda Console first"
    echo "     Then run: ./deploy-persistent-channels.sh"
fi
echo ""

# Check 6: API Gateway exists
echo "6. Checking API Gateway..."
if aws apigatewayv2 get-api --api-id td0dn99gi2 --region us-east-1 &> /dev/null; then
    api_name=$(aws apigatewayv2 get-api --api-id td0dn99gi2 --region us-east-1 --query 'Name' --output text)
    api_endpoint=$(aws apigatewayv2 get-api --api-id td0dn99gi2 --region us-east-1 --query 'ApiEndpoint' --output text)
    echo "   ✓ API Gateway exists"
    echo "     Name: $api_name"
    echo "     Endpoint: $api_endpoint"
else
    echo "   ✗ API Gateway not found (ID: td0dn99gi2)"
    all_good=false
fi
echo ""

# Check 7: API routes exist
echo "7. Checking API routes..."
routes=$(aws apigatewayv2 get-routes --api-id td0dn99gi2 --region us-east-1 --query 'Items[?contains(RouteKey, `channel`)].RouteKey' --output text 2>&1)
if [ -n "$routes" ]; then
    route_count=$(echo "$routes" | wc -w)
    echo "   ✓ Found $route_count channel-related routes"
    echo "$routes" | tr '\t' '\n' | while read route; do
        [ -n "$route" ] && echo "     - $route"
    done
else
    echo "   ⚠ No channel routes found"
    echo "     Run: ./add-persistent-channels-routes.sh"
fi
echo ""

# Check 8: IVS recording configuration exists
echo "8. Checking IVS recording configuration..."
recording_arn="arn:aws:ivs:us-east-1:124355640062:recording-configuration/NgV3p8AlWTTF"
if aws ivs get-recording-configuration --arn "$recording_arn" --region us-east-1 &> /dev/null; then
    recording_state=$(aws ivs get-recording-configuration --arn "$recording_arn" --region us-east-1 --query 'recordingConfiguration.state' --output text)
    echo "   ✓ Recording configuration exists"
    echo "     ARN: $recording_arn"
    echo "     State: $recording_state"
else
    echo "   ⚠ Recording configuration not found or not accessible"
    echo "     Channels will be created without recording"
fi
echo ""

# Summary
echo "========================================"
echo "Setup Check Summary"
echo "========================================"

if [ "$all_good" = true ] && [ $existing_functions -eq ${#functions[@]} ]; then
    echo "✓ All prerequisites are in place!"
    echo ""
    echo "Next steps:"
    echo "1. Deploy Lambda functions: ./deploy-persistent-channels.sh"
    echo "2. Create API routes: ./add-persistent-channels-routes.sh"
    echo "3. Run tests: ./test-persistent-channels.sh"
else
    echo "⚠ Some prerequisites are missing"
    echo ""
    echo "Please address the issues above before proceeding."
fi
echo ""
