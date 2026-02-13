# Setup Program Controller ECS Infrastructure
$region = "us-east-1"
$accountId = "124355640062"

Write-Host "Setting up Program Controller ECS infrastructure..." -ForegroundColor Cyan

# 1. Create SQS Queue
Write-Host "`n1. Creating SQS queue..." -ForegroundColor Yellow
aws sqs create-queue --queue-name shelcaster-program-commands --region $region 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ SQS queue created" -ForegroundColor Green
} else {
    Write-Host "   Queue may already exist" -ForegroundColor Gray
}

# 2. Create ECS Cluster
Write-Host "`n2. Creating ECS cluster..." -ForegroundColor Yellow
aws ecs create-cluster --cluster-name shelcaster-cluster --region $region 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ ECS cluster created" -ForegroundColor Green
} else {
    Write-Host "   Cluster may already exist" -ForegroundColor Gray
}

# 3. Create ECR Repository
Write-Host "`n3. Creating ECR repository..." -ForegroundColor Yellow
aws ecr create-repository --repository-name shelcaster-program-controller --region $region 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ ECR repository created" -ForegroundColor Green
} else {
    Write-Host "   Repository may already exist" -ForegroundColor Gray
}

# 4. Build and push Docker image
Write-Host "`n4. Building Docker image..." -ForegroundColor Yellow
Set-Location program-controller
docker build -t shelcaster-program-controller .

Write-Host "`n5. Pushing to ECR..." -ForegroundColor Yellow
aws ecr get-login-password --region $region | docker login --username AWS --password-stdin "$accountId.dkr.ecr.$region.amazonaws.com"
docker tag shelcaster-program-controller:latest "$accountId.dkr.ecr.$region.amazonaws.com/shelcaster-program-controller:latest"
docker push "$accountId.dkr.ecr.$region.amazonaws.com/shelcaster-program-controller:latest"
Set-Location ..

Write-Host "`n6. Creating ECS task execution role..." -ForegroundColor Yellow
$trustPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "ecs-tasks.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
"@
$trustPolicy | Out-File -FilePath "ecs-trust-policy.json" -Encoding utf8
aws iam create-role --role-name ecsTaskExecutionRole --assume-role-policy-document file://ecs-trust-policy.json 2>$null
aws iam attach-role-policy --role-name ecsTaskExecutionRole --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy" 2>$null

Write-Host "`n7. Creating ECS task role..." -ForegroundColor Yellow
aws iam create-role --role-name shelcaster-program-controller-role --assume-role-policy-document file://ecs-trust-policy.json 2>$null

$taskPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "ivs:CreateParticipantToken"
      ],
      "Resource": "*"
    }
  ]
}
"@
$taskPolicy | Out-File -FilePath "program-controller-policy.json" -Encoding utf8
aws iam put-role-policy --role-name shelcaster-program-controller-role --policy-name ProgramControllerPolicy --policy-document file://program-controller-policy.json

Write-Host "`n8. Registering ECS task definition..." -ForegroundColor Yellow
$taskDef = @"
{
  "family": "shelcaster-program-controller",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::$accountId:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::$accountId:role/shelcaster-program-controller-role",
  "containerDefinitions": [{
    "name": "program-controller",
    "image": "$accountId.dkr.ecr.$region.amazonaws.com/shelcaster-program-controller:latest",
    "essential": true,
    "environment": [
      {"name": "SESSION_ID", "value": "PLACEHOLDER"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/shelcaster-program-controller",
        "awslogs-region": "$region",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }]
}
"@
$taskDef | Out-File -FilePath "task-definition.json" -Encoding utf8
aws ecs register-task-definition --cli-input-json file://task-definition.json --region $region

Write-Host "`n9. Creating CloudWatch log group..." -ForegroundColor Yellow
aws logs create-log-group --log-group-name /ecs/shelcaster-program-controller --region $region 2>$null

Write-Host "`n✓ Program Controller infrastructure setup complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Update shelcaster-create-session Lambda to start ECS task"
Write-Host "2. Test track playback in the UI"
