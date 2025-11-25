@echo off
setlocal
set PROFILE=shelcaster-admin
set REGION=us-east-1

echo Creating ECS Task Execution Role...

REM Create trust policy
echo {"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]} > ecs-trust-policy.json

REM Create role
aws iam create-role --role-name ecsTaskExecutionRole --assume-role-policy-document file://ecs-trust-policy.json --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1

REM Attach managed policy
aws iam attach-role-policy --role-name ecsTaskExecutionRole --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1

REM Clean up
del ecs-trust-policy.json >nul 2>&1

echo ECS Task Execution Role created successfully!

