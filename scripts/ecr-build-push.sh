#!/usr/bin/env bash
# ==============================================================================
# SmartBusiness Solutions — Build & Push Containers to AWS ECR
# Usage:
#   AWS_REGION=ap-south-1 AWS_ACCOUNT_ID=348243984409 ./scripts/ecr-build-push.sh
# ==============================================================================

set -euo pipefail

# Auto-load variables from .env.production or .env
if [ -f .env.production ]; then
  set -a
  source .env.production
  set +a
elif [ -f .env ]; then
  set -a
  source .env
  set +a
fi

AWS_REGION="${AWS_REGION:-ap-south-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-348243984409}"
TAG="${TAG:-latest}"
ECR_BASE="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "==> Target AWS Region: ${AWS_REGION}"
echo "==> Target AWS Account ID: ${AWS_ACCOUNT_ID}"
echo "==> ECR Base Registry: ${ECR_BASE}"

echo "==> Authenticating Docker to AWS ECR..."
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_BASE}"

build_and_push() {
  local DOCKERFILE="$1"
  local REPO_NAME="$2"
  local CONTEXT="$3"

  echo "------------------------------------------------------------------"
  echo "==> Ensuring ECR repository '${REPO_NAME}' exists..."
  aws ecr create-repository --repository-name "${REPO_NAME}" --region "${AWS_REGION}" >/dev/null 2>&1 || true

  echo "==> Building ${REPO_NAME}:${TAG} using ${DOCKERFILE}..."
  docker build -f "${DOCKERFILE}" -t "${ECR_BASE}/${REPO_NAME}:${TAG}" "${CONTEXT}"

  echo "==> Pushing ${REPO_NAME}:${TAG} to ECR..."
  docker push "${ECR_BASE}/${REPO_NAME}:${TAG}"
}

# 1. Node.js Backend Microservices
build_and_push "apps/platform-api/Dockerfile" "smartbusiness/platform-api" "."
build_and_push "apps/check-printing-backend/Dockerfile" "smartbusiness/check-printing-backend" "."
build_and_push "apps/clockInClockOut-backend/Dockerfile" "smartbusiness/clockin-backend" "."

# 2. Python AI Microservices
build_and_push "apps/clockInClockout-face-recognition/Dockerfile" "smartbusiness/face-recognition" "apps/clockInClockout-face-recognition"
build_and_push "apps/chatbot-backend/Dockerfile" "smartbusiness/chatbot-backend" "apps/chatbot-backend"

# 3. React / Vite Frontends
build_and_push "apps/check-printing-frontend/Dockerfile" "smartbusiness/check-printing-frontend" "."
build_and_push "apps/clockInClockOut-frontend/Dockerfile" "smartbusiness/clockin-frontend" "."
build_and_push "apps/platform-web/Dockerfile" "smartbusiness/platform-web" "."
build_and_push "apps/chatbot-frontend/Dockerfile" "smartbusiness/chatbot-frontend" "."

# 4. Ingress / Reverse Proxy Gateway
build_and_push "docker/Dockerfile.gateway" "smartbusiness/gateway" "."

echo "==> All 10 images successfully built and pushed to AWS ECR!"
