# SmartBusiness — Daily Deployment Cheat Sheet (ECR → EC2)

Follow this exact short workflow whenever you make code changes locally and want them deployed live to your AWS EC2 instance.

---

## Step 1: On Your Local Computer (Build & Push to ECR)

### A. When You Update One App (e.g. Check Printing Frontend):
```bash
# 1. Login to AWS ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 348243984409.dkr.ecr.ap-south-1.amazonaws.com

# 2. Build the updated image (--no-cache ensures your newest code is picked up)
docker build --no-cache -t 348243984409.dkr.ecr.ap-south-1.amazonaws.com/smartbusiness/check-printing-frontend:latest -f apps/check-printing-frontend/Dockerfile .

# 3. Push to ECR
docker push 348243984409.dkr.ecr.ap-south-1.amazonaws.com/smartbusiness/check-printing-frontend:latest
```

*(For another app, simply change the name and Dockerfile path, e.g. `clockin-frontend`, `platform-api`, etc.)*

### B. When You Update Multiple Apps at Once:
```bash
export AWS_REGION="ap-south-1"
export AWS_ACCOUNT_ID="348243984409"
bash ./scripts/ecr-build-push.sh
```

---

## Step 2: On Your EC2 Server (`ubuntu@ip-172-31-13-150`)

Connect via SSH, navigate to `~/smartbusiness-solution`, and run:

```bash
# 1. Refresh ECR Login on EC2
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 348243984409.dkr.ecr.ap-south-1.amazonaws.com

# 2. Pull git changes (docker-compose, configs, env)
git pull

# 3. Pull new image(s) from ECR
docker compose -f docker-compose.prod.yml pull

# 4. Restart containers with the new image (Zero Downtime)
docker compose -f docker-compose.prod.yml up -d --force-recreate

# 5. Clean up old unused layers to save disk space
docker image prune -f

# 6. Verify containers are all Up
docker compose -f docker-compose.prod.yml ps
```

---

## 3. Quick Port & URL Reference (`15.206.10.255`)

| Service | Port | URL |
| :--- | :--- | :--- |
| **Main Portal Web** | `3003` | `http://15.206.10.255:3003` |
| **Check Printing App** | `5173` | `http://15.206.10.255:5173` |
| **ClockIn Attendance App** | `5174` | `http://15.206.10.255:5174` |
| **Face Recognition API** | `8000` | `http://15.206.10.255:8000/docs` |
| **Check Printing Backend** | `3005` | `http://15.206.10.255:3005/api/v1/health` |
| **Platform Auth Backend** | `3001` | `http://15.206.10.255:3001/api/v1/health` |
| **Attendance Backend** | `3000` | `http://15.206.10.255:3000/api/v1/health` |
| **Unified Nginx Gateway** | `80` | `http://15.206.10.255/` |
