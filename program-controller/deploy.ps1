# Deploy program-controller to ECS
# Builds Docker image, pushes to ECR, and updates ECS task definition

$ErrorActionPreference = "Stop"

$AWS_ACCOUNT_ID = "124355640062"
$AWS_REGION = "us-east-1"
$ECR_REPO = "shelcaster-program-controller"
$IMAGE_TAG = "latest"

Write-Host "Building Docker image..." -ForegroundColor Cyan
docker build -t ${ECR_REPO}:${IMAGE_TAG} .

Write-Host "Logging into ECR..." -ForegroundColor Cyan
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

Write-Host "Tagging image..." -ForegroundColor Cyan
docker tag ${ECR_REPO}:${IMAGE_TAG} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}:${IMAGE_TAG}

Write-Host "Pushing to ECR..." -ForegroundColor Cyan
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}:${IMAGE_TAG}

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Next: Stop existing ECS task to force new deployment" -ForegroundColor Yellow
Write-Host "Run: aws ecs list-tasks --cluster shelcaster-cluster --region us-east-1" -ForegroundColor Gray
Write-Host "Then: aws ecs stop-task --cluster shelcaster-cluster --task TASK_ARN --region us-east-1" -ForegroundColor Gray
