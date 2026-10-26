#!/usr/bin/env bash
# ==============================================================================
# SmartBusiness Solutions — Pull from ECR & Run on EC2
# Usage: Run directly on your EC2 instance in the project directory
# ==============================================================================

set -euo pipefail

if [ ! -f .env.production ]; then
    echo "ERROR: .env.production not found! Please create it before deploying."
    exit 1
fi

export $(grep -v '^#' .env.production | xargs)

ECR_BASE="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "==> Authenticating Docker to AWS ECR..."
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_BASE}"

echo "==> Pulling latest images from ECR..."
docker compose --env-file .env.production -f docker-compose.prod.yml pull

echo "==> Launching stack via Docker Compose..."
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --remove-orphans

echo "==> Cleaning up unused images to free EC2 disk space..."
docker image prune -af --filter "until=48h" || true

echo "==> Deployment successful! Running services:"
docker compose --env-file .env.production -f docker-compose.prod.yml ps
