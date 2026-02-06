# Test Phase A Implementation
# This script tests the PROGRAM Feed Abstraction backend

$API_BASE_URL = "https://td0dn99gi2.execute-api.us-east-1.amazonaws.com"
$REGION = "us-east-1"
$PROFILE = "shelcaster-admin"

Write-Host "=== PHASE A INTEGRATION TEST ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Get a test show ID
Write-Host "Step 1: Getting test show..." -ForegroundColor Yellow
$SHOW_ID = "test-show-001" # Replace with actual show ID from your database

# Step 2: Create a session
Write-Host "Step 2: Creating LiveSession..." -ForegroundColor Yellow
Write-Host "Note: This requires a valid JWT token. You'll need to get this from the frontend." -ForegroundColor Gray
Write-Host "For now, we'll test using AWS CLI to check DynamoDB directly." -ForegroundColor Gray
Write-Host ""

# Alternative: Check if any sessions exist
Write-Host "Checking for existing sessions in DynamoDB..." -ForegroundColor Yellow
aws dynamodb scan `
    --table-name shelcaster-app `
    --filter-expression "entityType = :type" `
    --expression-attribute-values '{":type":{"S":"liveSession"}}' `
    --region $REGION `
    --profile $PROFILE `
    --query 'Items[0]' `
    --output json

Write-Host ""
Write-Host "=== MANUAL TESTING STEPS ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open the Shelcaster Studio frontend" -ForegroundColor White
Write-Host "2. Log in as a host" -ForegroundColor White
Write-Host "3. Click 'Join Stage' - this will create a LiveSession" -ForegroundColor White
Write-Host "4. Check the browser console for the sessionId" -ForegroundColor White
Write-Host "5. Use the sessionId to verify the following:" -ForegroundColor White
Write-Host ""
Write-Host "   a) Check DynamoDB for LiveSession record:" -ForegroundColor Gray
Write-Host "      aws dynamodb get-item --table-name shelcaster-app --key '{\"pk\":{\"S\":\"session#YOUR_SESSION_ID\"},\"sk\":{\"S\":\"info\"}}' --region us-east-1 --profile shelcaster-admin" -ForegroundColor DarkGray
Write-Host ""
Write-Host "   b) Verify the record contains:" -ForegroundColor Gray
Write-Host "      - ivs.rawStageArn" -ForegroundColor DarkGray
Write-Host "      - ivs.programStageArn" -ForegroundColor DarkGray
Write-Host "      - ivs.programChannelArn" -ForegroundColor DarkGray
Write-Host "      - ivs.programPlaybackUrl" -ForegroundColor DarkGray
Write-Host ""
Write-Host "   c) Call start-program endpoint (requires JWT):" -ForegroundColor Gray
Write-Host "      POST $API_BASE_URL/sessions/YOUR_SESSION_ID/start-program" -ForegroundColor DarkGray
Write-Host ""
Write-Host "   d) Verify composition started:" -ForegroundColor Gray
Write-Host "      - Check for ivs.compositionArn in DynamoDB" -ForegroundColor DarkGray
Write-Host "      - Check streaming.isLive = true" -ForegroundColor DarkGray
Write-Host ""
Write-Host "=== EXPECTED RESULTS ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "✓ LiveSession created with RAW and PROGRAM stage ARNs" -ForegroundColor Green
Write-Host "✓ PROGRAM channel created with playback URL" -ForegroundColor Green
Write-Host "✓ Composition can be started on PROGRAM stage" -ForegroundColor Green
Write-Host "✓ S3 recording destination configured" -ForegroundColor Green
Write-Host ""
Write-Host "=== PHASE A LIMITATIONS ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠ PROGRAM controller is not yet running (ECS/Fargate deployment pending)" -ForegroundColor Yellow
Write-Host "⚠ No video will appear in PROGRAM channel until controller is deployed" -ForegroundColor Yellow
Write-Host "⚠ Switching sources updates DynamoDB but has no effect on output" -ForegroundColor Yellow
Write-Host ""
Write-Host "=== NEXT STEPS (Phase B) ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Deploy PROGRAM controller to ECS/Fargate" -ForegroundColor White
Write-Host "2. Integrate IVS Web Broadcast SDK in controller" -ForegroundColor White
Write-Host "3. Implement caller switching logic" -ForegroundColor White
Write-Host "4. Test end-to-end switching with multiple callers" -ForegroundColor White
Write-Host ""

