#!/bin/bash
# Test Persistent IVS Channels API
# This script tests all persistent channel endpoints

set +e  # Continue on errors

API_BASE_URL="https://td0dn99gi2.execute-api.us-east-1.amazonaws.com"
TEST_USER_ID="test-user-$RANDOM"

echo "========================================"
echo "Testing Persistent Channels API"
echo "========================================"
echo ""
echo "API Base URL: $API_BASE_URL"
echo "Test User ID: $TEST_USER_ID"
echo ""

# Store test data
test_channel_id=""
test_channel_arn=""

# Test 1: Get Channel Capacity
echo "Test 1: Get Channel Capacity"
echo "GET /admin/channels/capacity"
response=$(curl -s "$API_BASE_URL/admin/channels/capacity")
if [ $? -eq 0 ]; then
    echo "✓ Success"
    echo "$response" | grep -o '"currentChannelCount":[0-9]*' | cut -d':' -f2 | xargs -I {} echo "  Current Channels: {}"
    echo "$response" | grep -o '"maxChannelLimit":[0-9]*' | cut -d':' -f2 | xargs -I {} echo "  Max Limit: {}"
    echo "$response" | grep -o '"remainingCapacity":[0-9]*' | cut -d':' -f2 | xargs -I {} echo "  Remaining: {}"
else
    echo "✗ Failed"
fi
echo ""

# Test 2: Create Persistent Channel
echo "Test 2: Create Persistent Channel"
echo "POST /admin/channels"
timestamp=$(date +%H%M%S)
response=$(curl -s -X POST "$API_BASE_URL/admin/channels" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Test Channel $timestamp\",\"recordingEnabled\":true}")

if echo "$response" | grep -q "channelId"; then
    test_channel_id=$(echo "$response" | grep -o '"channelId":"[^"]*"' | cut -d'"' -f4)
    test_channel_arn=$(echo "$response" | grep -o '"channelArn":"[^"]*"' | cut -d'"' -f4)
    playback_url=$(echo "$response" | grep -o '"playbackUrl":"[^"]*"' | cut -d'"' -f4)
    state=$(echo "$response" | grep -o '"state":"[^"]*"' | cut -d'"' -f4)
    
    echo "✓ Success"
    echo "  Channel ID: $test_channel_id"
    echo "  Channel ARN: $test_channel_arn"
    echo "  Playback URL: $playback_url"
    echo "  State: $state"
else
    echo "✗ Failed"
    echo "  Response: $response"
fi
echo ""

if [ -z "$test_channel_id" ]; then
    echo "Cannot continue tests without a channel. Exiting."
    exit 1
fi

# Test 3: List All Channels
echo "Test 3: List All Channels"
echo "GET /admin/channels"
response=$(curl -s "$API_BASE_URL/admin/channels")
if echo "$response" | grep -q "channels"; then
    count=$(echo "$response" | grep -o '"count":[0-9]*' | cut -d':' -f2)
    echo "✓ Success"
    echo "  Total Channels: $count"
else
    echo "✗ Failed"
fi
echo ""

# Test 4: List Channels by State (IDLE)
echo "Test 4: List Channels by State (IDLE)"
echo "GET /admin/channels?state=IDLE"
response=$(curl -s "$API_BASE_URL/admin/channels?state=IDLE")
if echo "$response" | grep -q "channels"; then
    count=$(echo "$response" | grep -o '"count":[0-9]*' | cut -d':' -f2)
    echo "✓ Success"
    echo "  IDLE Channels: $count"
else
    echo "✗ Failed"
fi
echo ""

# Test 5: Get Channel Statistics
echo "Test 5: Get Channel Statistics"
echo "GET /admin/channels/$test_channel_id/stats"
response=$(curl -s "$API_BASE_URL/admin/channels/$test_channel_id/stats")
if echo "$response" | grep -q "channelId"; then
    total_broadcasts=$(echo "$response" | grep -o '"totalBroadcasts":[0-9]*' | cut -d':' -f2)
    total_hours=$(echo "$response" | grep -o '"totalStreamingHours":"[^"]*"' | cut -d'"' -f4)
    current_state=$(echo "$response" | grep -o '"currentState":"[^"]*"' | cut -d'"' -f4)
    
    echo "✓ Success"
    echo "  Total Broadcasts: $total_broadcasts"
    echo "  Total Streaming Hours: $total_hours"
    echo "  Current State: $current_state"
else
    echo "✗ Failed"
fi
echo ""

# Test 6: Assign Channel to Host
echo "Test 6: Assign Channel to Host"
echo "POST /admin/channels/$test_channel_id/assign"
response=$(curl -s -X POST "$API_BASE_URL/admin/channels/$test_channel_id/assign" \
    -H "Content-Type: application/json" \
    -d "{\"hostUserId\":\"$TEST_USER_ID\"}")

if echo "$response" | grep -q "assignment"; then
    echo "✓ Success"
    echo "  Host User ID: $TEST_USER_ID"
    echo "  Channel ID: $test_channel_id"
else
    echo "✗ Failed"
    echo "  Response: $response"
fi
echo ""

# Test 7: Get Host's Assigned Channel
echo "Test 7: Get Host's Assigned Channel"
echo "GET /hosts/$TEST_USER_ID/channel"
response=$(curl -s "$API_BASE_URL/hosts/$TEST_USER_ID/channel")
if echo "$response" | grep -q "channelId"; then
    channel_id=$(echo "$response" | grep -o '"channelId":"[^"]*"' | cut -d'"' -f4)
    channel_name=$(echo "$response" | grep -o '"channelName":"[^"]*"' | cut -d'"' -f4)
    state=$(echo "$response" | grep -o '"state":"[^"]*"' | cut -d'"' -f4)
    
    echo "✓ Success"
    echo "  Channel ID: $channel_id"
    echo "  Channel Name: $channel_name"
    echo "  State: $state"
else
    echo "✗ Failed"
fi
echo ""

# Test 8: Update Channel State to LIVE
echo "Test 8: Update Channel State to LIVE"
echo "PUT /admin/channels/$test_channel_id/state"
response=$(curl -s -X PUT "$API_BASE_URL/admin/channels/$test_channel_id/state" \
    -H "Content-Type: application/json" \
    -d "{\"newState\":\"LIVE\",\"sessionId\":\"test-session-123\"}")

if echo "$response" | grep -q "newState"; then
    new_state=$(echo "$response" | grep -o '"newState":"[^"]*"' | cut -d'"' -f4)
    session_id=$(echo "$response" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
    
    echo "✓ Success"
    echo "  New State: $new_state"
    echo "  Session ID: $session_id"
else
    echo "✗ Failed"
fi
echo ""

# Test 9: Update Channel State back to IDLE
echo "Test 9: Update Channel State back to IDLE"
echo "PUT /admin/channels/$test_channel_id/state"
response=$(curl -s -X PUT "$API_BASE_URL/admin/channels/$test_channel_id/state" \
    -H "Content-Type: application/json" \
    -d "{\"newState\":\"IDLE\",\"sessionId\":null}")

if echo "$response" | grep -q "newState"; then
    new_state=$(echo "$response" | grep -o '"newState":"[^"]*"' | cut -d'"' -f4)
    echo "✓ Success"
    echo "  New State: $new_state"
else
    echo "✗ Failed"
fi
echo ""

# Test 10: Unassign Channel from Host
echo "Test 10: Unassign Channel from Host"
echo "DELETE /admin/channels/$test_channel_id/assign/$TEST_USER_ID"
response=$(curl -s -X DELETE "$API_BASE_URL/admin/channels/$test_channel_id/assign/$TEST_USER_ID")
if echo "$response" | grep -q "unassigned"; then
    echo "✓ Success"
    echo "  Channel unassigned from host"
else
    echo "✗ Failed"
fi
echo ""

# Test 11: Verify Host Has No Channel (should fail)
echo "Test 11: Verify Host Has No Channel (should return 404)"
echo "GET /hosts/$TEST_USER_ID/channel"
http_code=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE_URL/hosts/$TEST_USER_ID/channel")
if [ "$http_code" = "404" ]; then
    echo "✓ Success - Correctly returned 404"
else
    echo "✗ Unexpected response code: $http_code"
fi
echo ""

echo "========================================"
echo "Testing Complete"
echo "========================================"
echo ""
echo "Test Channel Created:"
echo "  Channel ID: $test_channel_id"
echo "  Channel ARN: $test_channel_arn"
echo ""
echo "Note: The test channel was created but not deleted."
echo "You can manually delete it from AWS IVS Console if needed."
