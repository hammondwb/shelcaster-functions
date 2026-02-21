# Add Cognito ListUsers permission to lambda-dynamodb-role

$ErrorActionPreference = "Stop"

$ROLE_NAME = "lambda-dynamodb-role"
$POLICY_NAME = "CognitoListUsersPolicy"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Adding Cognito Permissions to Lambda Role" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create policy document
$policyDocument = @"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "cognito-idp:ListUsers"
            ],
            "Resource": "arn:aws:cognito-idp:us-east-1:124355640062:userpool/us-east-1_VYdYII5Yw"
        }
    ]
}
"@

# Save policy to temp file
$policyDocument | Out-File -FilePath "cognito-policy.json" -Encoding utf8

Write-Host "Policy document created:" -ForegroundColor Yellow
Write-Host $policyDocument -ForegroundColor Gray
Write-Host ""

# Create the policy
Write-Host "Creating IAM policy..." -ForegroundColor Yellow
try {
    $policyArn = aws iam create-policy `
        --policy-name $POLICY_NAME `
        --policy-document file://cognito-policy.json `
        --query 'Policy.Arn' `
        --output text 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Policy created: $policyArn" -ForegroundColor Green
    } else {
        # Policy might already exist, try to get it
        Write-Host "  Policy might already exist, looking it up..." -ForegroundColor Yellow
        $policyArn = aws iam list-policies `
            --query "Policies[?PolicyName=='$POLICY_NAME'].Arn" `
            --output text
        
        if ($policyArn) {
            Write-Host "  ✓ Found existing policy: $policyArn" -ForegroundColor Green
        } else {
            throw "Failed to create or find policy"
        }
    }
} catch {
    Write-Host "  ✗ Error creating policy: $_" -ForegroundColor Red
    Remove-Item cognito-policy.json -ErrorAction SilentlyContinue
    exit 1
}

# Attach policy to role
Write-Host "Attaching policy to role..." -ForegroundColor Yellow
try {
    aws iam attach-role-policy `
        --role-name $ROLE_NAME `
        --policy-arn $policyArn
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Policy attached to role" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Policy might already be attached" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ✗ Error attaching policy: $_" -ForegroundColor Red
    Remove-Item cognito-policy.json -ErrorAction SilentlyContinue
    exit 1
}

# Clean up temp file
Remove-Item cognito-policy.json -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "The lambda-dynamodb-role now has permission to list Cognito users." -ForegroundColor Green
Write-Host ""
Write-Host "You can now deploy the user lookup function:" -ForegroundColor Yellow
Write-Host "  .\deploy-lookup-user.ps1" -ForegroundColor Gray
