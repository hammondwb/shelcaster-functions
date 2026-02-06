# Shelcaster PROGRAM Controller

## Overview

The PROGRAM Controller is a Node.js service that runs in ECS/Fargate and acts as a virtual participant in the IVS Real-Time architecture. It implements the PROGRAM Feed Abstraction pattern for true single-source switching without stream interruption.

## Architecture

```
RAW Stage (host + callers)
    ↓
PROGRAM Controller (ECS/Fargate)
    ↓
PROGRAM Stage (single virtual participant)
    ↓
IVS Composition → Channel + S3 Recording
```

## Phase A Implementation

Phase A is a minimal implementation that:
- Reads LiveSession from DynamoDB
- Creates participant tokens for RAW and PROGRAM stages
- Logs initialization (actual IVS SDK integration pending)
- Keeps the process running with heartbeat logs

## Deployment

### Prerequisites

- AWS CLI configured with `shelcaster-admin` profile
- Docker installed
- ECR repository created: `shelcaster-program-controller`

### Build and Push Docker Image

```bash
# Navigate to program-controller directory
cd program-controller

# Build Docker image
docker build -t shelcaster-program-controller .

# Tag for ECR
docker tag shelcaster-program-controller:latest 124355640062.dkr.ecr.us-east-1.amazonaws.com/shelcaster-program-controller:latest

# Login to ECR
aws ecr get-login-password --region us-east-1 --profile shelcaster-admin | docker login --username AWS --password-stdin 124355640062.dkr.ecr.us-east-1.amazonaws.com

# Push to ECR
docker push 124355640062.dkr.ecr.us-east-1.amazonaws.com/shelcaster-program-controller:latest
```

### Create ECS Task Definition

```bash
# Create task definition JSON (see task-definition.json)
aws ecs register-task-definition --cli-input-json file://task-definition.json --region us-east-1 --profile shelcaster-admin
```

### Run as ECS Fargate Task

```bash
# Run task (replace SESSION_ID with actual session ID)
aws ecs run-task \
  --cluster shelcaster-cluster \
  --task-definition shelcaster-program-controller \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --overrides "{\"containerOverrides\":[{\"name\":\"program-controller\",\"environment\":[{\"name\":\"SESSION_ID\",\"value\":\"YOUR_SESSION_ID\"}]}]}" \
  --region us-east-1 \
  --profile shelcaster-admin
```

## Environment Variables

- `SESSION_ID` (required): The LiveSession ID to control

## Next Steps (Phase B)

- Integrate `amazon-ivs-web-broadcast` SDK
- Join RAW stage as subscriber
- Join PROGRAM stage as publisher
- Subscribe to active participant on RAW stage
- Republish to PROGRAM stage
- Poll SQS for SWITCH_SOURCE commands
- Implement caller switching logic

