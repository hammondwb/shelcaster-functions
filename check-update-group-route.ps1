# Check if update-group API route exists
$API_ID = "td0dn99gi2"
$REGION = "us-east-1"

Write-Host "Checking for update-group API route..." -ForegroundColor Cyan

# Get all resources
$resources = aws apigateway get-resources --rest-api-id $API_ID --region $REGION | ConvertFrom-Json

# Find the groups resource
$groupsResource = $resources.items | Where-Object { $_.pathPart -eq "groups" }

if ($groupsResource) {
    Write-Host "Found groups resource: $($groupsResource.path)" -ForegroundColor Green
    
    # Check if {groupId} resource exists under groups
    $groupIdResource = $resources.items | Where-Object { 
        $_.pathPart -eq "{groupId}" -and $_.parentId -eq $groupsResource.id 
    }
    
    if ($groupIdResource) {
        Write-Host "Found {groupId} resource: $($groupIdResource.path)" -ForegroundColor Green
        
        # Check for PATCH method
        $methods = aws apigateway get-resource --rest-api-id $API_ID --resource-id $groupIdResource.id --region $REGION | ConvertFrom-Json
        
        if ($methods.resourceMethods -and $methods.resourceMethods.PATCH) {
            Write-Host "✓ PATCH method exists on /users/{userId}/groups/{groupId}" -ForegroundColor Green
            Write-Host "Route is already configured!" -ForegroundColor Green
        } else {
            Write-Host "✗ PATCH method NOT found" -ForegroundColor Red
            Write-Host "Run add-update-group-route.ps1 to add it" -ForegroundColor Yellow
        }
    } else {
        Write-Host "✗ {groupId} resource NOT found under groups" -ForegroundColor Red
        Write-Host "Run add-update-group-route.ps1 to add it" -ForegroundColor Yellow
    }
} else {
    Write-Host "✗ groups resource NOT found" -ForegroundColor Red
    Write-Host "Run add-update-group-route.ps1 to add it" -ForegroundColor Yellow
}
