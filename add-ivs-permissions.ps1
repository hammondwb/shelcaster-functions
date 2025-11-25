# Add IVS permissions to Lambda execution role

$PROFILE = "shelcaster-admin"
$REGION = "us-east-1"
$ROLE_NAME = "lambda-dynamodb-role"

Write-Host "Adding IVS permissions to Lambda role..." -ForegroundColor Green

# Create IVS policy document
$ivsPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ivs:CreateChannel",
        "ivs:GetChannel",
        "ivs:ListChannels",
        "ivs:DeleteChannel",
        "ivs:UpdateChannel",
        "ivs:GetStream",
        "ivs:ListStreams",
        "ivs:StopStream",
        "ivs:CreateStreamKey",
        "ivs:GetStreamKey",
        "ivs:ListStreamKeys",
        "ivs:DeleteStreamKey",
        "ivs:CreateRecordingConfiguration",
        "ivs:GetRecordingConfiguration",
        "ivs:ListRecordingConfigurations",
        "ivs:PutMetadata"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::shelcaster-media-bucket/*",
        "arn:aws:s3:::shelcaster-media-bucket"
      ]
    }
  ]
}
"@

$ivsPolicy | Out-File -FilePath "lambda-ivs-policy.json" -Encoding utf8

# Check if policy already exists
$policyArn = "arn:aws:iam::124355640062:policy/LambdaIVSPolicy"
$policyExists = aws iam get-policy --policy-arn $policyArn --profile $PROFILE 2>&1

if ($LASTEXITCODE -ne 0) {
    # Create the policy
    Write-Host "Creating IVS policy..." -ForegroundColor Yellow
    $policyArn = aws iam create-policy `
        --policy-name LambdaIVSPolicy `
        --policy-document file://lambda-ivs-policy.json `
        --profile $PROFILE `
        --query "Policy.Arn" `
        --output text
    
    Write-Host "  Created policy: $policyArn" -ForegroundColor Green
} else {
    Write-Host "Policy already exists: $policyArn" -ForegroundColor Green
    
    # Update the policy with a new version
    Write-Host "Creating new policy version..." -ForegroundColor Yellow
    aws iam create-policy-version `
        --policy-arn $policyArn `
        --policy-document file://lambda-ivs-policy.json `
        --set-as-default `
        --profile $PROFILE `
        --no-cli-pager | Out-Null
    
    Write-Host "  Updated policy version" -ForegroundColor Green
}

# Attach policy to role
Write-Host "Attaching policy to role..." -ForegroundColor Yellow
aws iam attach-role-policy `
    --role-name $ROLE_NAME `
    --policy-arn $policyArn `
    --profile $PROFILE 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Policy attached to $ROLE_NAME" -ForegroundColor Green
} else {
    Write-Host "  Policy already attached or error occurred" -ForegroundColor Yellow
}

# Clean up
Remove-Item "lambda-ivs-policy.json" -ErrorAction SilentlyContinue

Write-Host "`n✅ IVS permissions added successfully!" -ForegroundColor Green

