# Setup Program Controller - Simplified
Write-Host "Setting up Program Controller..." -ForegroundColor Cyan

# 1. Create SQS Queue
Write-Host "`n1. Creating SQS queue..." -ForegroundColor Yellow
aws sqs create-queue --queue-name shelcaster-program-commands --region us-east-1

# 2. Create ECS Cluster
Write-Host "`n2. Creating ECS cluster..." -ForegroundColor Yellow
aws ecs create-cluster --cluster-name shelcaster-cluster --region us-east-1

# 3. Create IAM roles
Write-Host "`n3. Creating IAM roles..." -ForegroundColor Yellow
aws iam create-role --role-name ecsTaskExecutionRole --assume-role-policy-document file://ecs-trust-policy.json
aws iam attach-role-policy --role-name ecsTaskExecutionRole --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"

# 4. Create CloudWatch log group
Write-Host "`n4. Creating CloudWatch log group..." -ForegroundColor Yellow
aws logs create-log-group --log-group-name /ecs/shelcaster-program-controller --region us-east-1

Write-Host "`n✓ Setup complete!" -ForegroundColor Green
Write-Host "`nNote: Docker image build and ECS task definition registration skipped."
Write-Host "The program-controller requires Docker and ECR setup."
