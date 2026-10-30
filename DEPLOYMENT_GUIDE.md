# SmartBusiness — Clean Deployment Guide (Delete Old Build & Fresh Rebuild)

Follow this guide whenever you want to **completely delete the old build/container** and build a fresh one on EC2 with `--no-cache`.

---

## Workflow: Delete Old Build & Start Fresh on EC2

Always connect to EC2 via SSH and navigate to the project directory:
```bash
cd ~/smartbusiness-solution
git pull
```

---

## 1. Separate Commands for Each Container

Copy and run the exact 3-line block for whichever service you updated:

### 1. ClockIn Attendance Frontend (Port 5174)
```bash
docker compose -f docker-compose.prod.yml rm -sf clockin-frontend
docker rmi -f smartbusiness/clockin-frontend:latest 2>/dev/null || true
docker compose -f docker-compose.prod.yml build --no-cache clockin-frontend
docker compose -f docker-compose.prod.yml up -d --force-recreate clockin-frontend
```

### 2. Check Printing Frontend (Port 5173)
```bash
docker compose -f docker-compose.prod.yml rm -sf check-printing-frontend
docker rmi -f smartbusiness/check-printing-frontend:latest 2>/dev/null || true
docker compose -f docker-compose.prod.yml build --no-cache check-printing-frontend
docker compose -f docker-compose.prod.yml up -d --force-recreate check-printing-frontend
```

### 3. Platform Marketing Website (Port 3003)
```bash
docker compose -f docker-compose.prod.yml rm -sf platform-web
docker rmi -f smartbusiness/platform-web:latest 2>/dev/null || true
docker compose -f docker-compose.prod.yml build --no-cache platform-web
docker compose -f docker-compose.prod.yml up -d --force-recreate platform-web
```

### 4. Chatbot Admin Frontend (Port 5175)
```bash
docker compose -f docker-compose.prod.yml rm -sf chatbot-frontend
docker rmi -f smartbusiness/chatbot-frontend:latest 2>/dev/null || true
docker compose -f docker-compose.prod.yml build --no-cache chatbot-frontend
docker compose -f docker-compose.prod.yml up -d --force-recreate chatbot-frontend
```

### 5. Platform Auth & Core API (Port 3001)
```bash
docker compose -f docker-compose.prod.yml rm -sf platform-api
docker rmi -f smartbusiness/platform-api:latest 2>/dev/null || true
docker compose -f docker-compose.prod.yml build --no-cache platform-api
docker compose -f docker-compose.prod.yml up -d --force-recreate platform-api
```

### 6. ClockIn / Attendance Backend (Port 3000)
```bash
docker compose -f docker-compose.prod.yml rm -sf clockin-backend
docker rmi -f smartbusiness/clockin-backend:latest 2>/dev/null || true
docker compose -f docker-compose.prod.yml build --no-cache clockin-backend
docker compose -f docker-compose.prod.yml up -d --force-recreate clockin-backend
```

### 7. Check Printing Backend (Port 3005)
```bash
docker compose -f docker-compose.prod.yml rm -sf check-printing-backend
docker rmi -f smartbusiness/check-printing-backend:latest 2>/dev/null || true
docker compose -f docker-compose.prod.yml build --no-cache check-printing-backend
docker compose -f docker-compose.prod.yml up -d --force-recreate check-printing-backend
```

### 8. Biometric Face Recognition API (Port 8000)
```bash
docker compose -f docker-compose.prod.yml rm -sf face-recognition
docker rmi -f smartbusiness/face-recognition:latest 2>/dev/null || true
docker compose -f docker-compose.prod.yml build --no-cache face-recognition
docker compose -f docker-compose.prod.yml up -d --force-recreate face-recognition
```

### 9. RAG Chatbot Backend (Port 8001)
```bash
docker compose -f docker-compose.prod.yml rm -sf chatbot-backend
docker rmi -f smartbusiness/chatbot-backend:latest 2>/dev/null || true
docker compose -f docker-compose.prod.yml build --no-cache chatbot-backend
docker compose -f docker-compose.prod.yml up -d --force-recreate chatbot-backend
```

### 10. Unified Nginx Gateway (Port 80 / 443)
```bash
docker compose -f docker-compose.prod.yml restart gateway
```

---

## 2. To Delete Old Builds & Rebuild ALL 11 Containers at Once

If you made big changes or want every single container completely rebuilt fresh:
```bash
cd ~/smartbusiness-solution
git pull

# 1. Stop and remove all running containers
docker compose -f docker-compose.prod.yml down

# 2. Prune old images and dangling build cache
docker image prune -af

# 3. Build ALL containers from scratch without cache
docker compose -f docker-compose.prod.yml build --no-cache

# 4. Start all 11 containers fresh
docker compose -f docker-compose.prod.yml up -d --force-recreate

# 5. Verify all 11 are running
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
