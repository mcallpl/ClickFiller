# ClickFiller Deployment Guide

Production-ready deployment instructions for ClickFiller on Digital Ocean using Docker and nginx.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Local Testing](#local-testing)
3. [Digital Ocean Setup](#digital-ocean-setup)
4. [SSL/TLS Configuration](#ssltls-configuration)
5. [Deployment](#deployment)
6. [Monitoring](#monitoring)
7. [Troubleshooting](#troubleshooting)
8. [Rollback](#rollback)

## Prerequisites

### Local Machine
- Docker 20.10+
- docker-compose 2.0+
- Git
- SSH key for Digital Ocean access

### Digital Ocean
- Droplet with Ubuntu 22.04 LTS or later (minimum 2GB RAM, 1 CPU)
- Root or sudo access
- Domain name pointing to your droplet IP
- Let's Encrypt SSL certificate (free)

## Local Testing

### 1. Build and Run Locally

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your ANTHROPIC_API_KEY
nano .env

# Build Docker image
docker build -t clickfiller:latest .

# Run with docker-compose
docker-compose up

# In another terminal, verify health check
curl http://localhost/health

# Access application
# Frontend: http://localhost
# API: http://localhost/api/analyze (POST)
```

### 2. Test Complete Workflow

```bash
# 1. Save profile data
# Navigate to http://localhost and fill in "My Info" tab

# 2. Upload a form image
# Use the camera or upload functionality

# 3. Verify form analysis
# Check that fields are detected and filled

# 4. Download PDF
# Click download button and verify output
```

### 3. View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f nginx

# Clean up
docker-compose down
```

## Digital Ocean Setup

### 1. Create Droplet

```bash
# Using doctl CLI:
doctl compute droplet create clickfiller-app \
  --region nyc3 \
  --size s-1vcpu-2gb \
  --image ubuntu-22-04-x64 \
  --ssh-keys <your-key-id>

# Or use Digital Ocean Console at https://cloud.digitalocean.com
```

### 2. SSH into Droplet

```bash
ssh root@<droplet-ip>

# Update system
apt update && apt upgrade -y

# Install Docker
apt install -y docker.io docker-compose git curl

# Start Docker service
systemctl start docker
systemctl enable docker

# Add your user to docker group (if not root)
usermod -aG docker $USER
newgrp docker
```

### 3. Clone Repository

```bash
# Create app directory
mkdir -p /app/clickfiller
cd /app/clickfiller

# Clone the repository
git clone https://github.com/yourusername/clickfiller.git .

# Or if using SSH:
git clone git@github.com:yourusername/clickfiller.git .
```

### 4. Configure Environment

```bash
# Create .env from template
cp .env.example .env

# Edit and add your API key
nano .env
# Set ANTHROPIC_API_KEY=your-actual-key
# Set NODE_ENV=production
```

### 5. Domain Setup

Add your domain DNS records pointing to the droplet IP:

```
A Record:
  Name: @
  Value: <droplet-ip>

A Record:
  Name: www
  Value: <droplet-ip>
```

Wait for DNS propagation (usually 5-15 minutes):

```bash
# Verify DNS is live
nslookup yourdomain.com
```

## SSL/TLS Configuration

### 1. Install Certbot

```bash
apt install -y certbot python3-certbot-nginx

# Create certificate (replace with your domain)
certbot certonly --standalone \
  -d yourdomain.com \
  -d www.yourdomain.com \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email
```

### 2. Update Nginx Configuration

The nginx container needs access to certificates. Add to docker-compose.yml:

```yaml
volumes:
  - /etc/letsencrypt:/etc/letsencrypt:ro
```

### 3. Enable HTTPS

Update `nginx/clickfiller.conf`:

1. Uncomment the HTTP to HTTPS redirect:
```nginx
return 301 https://$host$request_uri;
```

2. Include the SSL configuration in the main config or create a separate file for your domain

### 4. Auto-Renewal

```bash
# Test renewal
certbot renew --dry-run

# Auto-renewal is enabled by default via systemd timer
systemctl status certbot.timer
```

## Deployment

### Option 1: Using Deploy Script (Recommended)

```bash
cd /app/clickfiller

# Run deployment script
./scripts/deploy.sh

# View output:
# - Docker image builds
# - Old containers stop
# - New containers start
# - Health check performed
# - Deployment summary shown
```

### Option 2: Manual Deployment

```bash
cd /app/clickfiller

# Pull latest code
git pull origin main

# Build Docker image
docker build -t clickfiller:latest .

# Stop and remove old containers
docker-compose down

# Start new containers
docker-compose up -d

# Wait for services to be healthy
sleep 10
curl http://localhost/health
```

### Option 3: GitHub Actions (Automatic)

Configure your GitHub repository:

1. Add secrets in GitHub Settings:
   - `DOCKER_REGISTRY_USERNAME` (optional, if using Docker Hub)
   - `DOCKER_REGISTRY_PASSWORD` (optional)
   - `DEPLOY_HOST`
   - `DEPLOY_KEY` (SSH private key)

2. The `.github/workflows/deploy.yml` will:
   - Build and test on every push to main
   - Run linter and tests
   - Build Docker image
   - Deploy (manual trigger or auto)

## Monitoring

### Health Check

```bash
# Check service health
curl http://yourdomain.com/health

# Expected response:
# {"status":"ok","timestamp":1234567890,"service":"ClickFiller API"}
```

### View Logs

```bash
# Real-time logs
docker-compose logs -f

# Last 50 lines
docker-compose logs --tail=50

# Specific service
docker-compose logs -f app
docker-compose logs -f nginx

# Logs on disk
ls -la /var/lib/docker/containers/*/
```

### Performance Monitoring

```bash
# Check resource usage
docker stats

# Check disk space
df -h

# Check memory
free -h

# Monitor processes
docker-compose ps
```

## Troubleshooting

### App Won't Start

```bash
# Check logs
docker-compose logs app

# Check if port 3001 is in use
lsof -i :3001
docker ps -a

# Rebuild image
docker build --no-cache -t clickfiller:latest .
docker-compose up -d
```

### Nginx Can't Connect to App

```bash
# Check if app container is running
docker-compose ps app

# Verify health endpoint
docker-compose exec app curl http://localhost:3001/health

# Check nginx logs
docker-compose logs nginx

# Verify app is listening
docker-compose exec app netstat -an | grep 3001
```

### SSL Certificate Issues

```bash
# Check certificate status
certbot certificates

# Verify cert is valid
openssl s_client -connect yourdomain.com:443

# Renew certificate manually
certbot renew --force-renewal

# Check cert permissions
ls -la /etc/letsencrypt/live/yourdomain.com/
```

### High Memory Usage

```bash
# Check current usage
docker stats

# Increase memory limit in docker-compose.yml
# Under deploy > resources > limits

# Restart with new limits
docker-compose restart
```

### API Key Issues

```bash
# Verify key is set in container
docker-compose exec app printenv ANTHROPIC_API_KEY

# Check if key is valid
docker-compose logs app | grep -i "anthropic\|api"

# Update .env and restart
nano .env
docker-compose restart app
```

## Rollback

### Quick Rollback

```bash
# If deployment fails, rollback script will auto-stop containers
# To manually rollback:

docker-compose down

# Revert to previous commit
git revert HEAD

# Rebuild and restart
./scripts/deploy.sh
```

### Using Git Tags

```bash
# Tag a stable release
git tag -a v1.0.0 -m "Stable release"
git push origin v1.0.0

# Deploy to specific tag
git checkout v1.0.0
docker build -t clickfiller:v1.0.0 .
docker-compose up -d
```

## Maintenance

### Regular Updates

```bash
# Update dependencies
docker-compose pull

# Rebuild base images
docker build --pull -t clickfiller:latest .

# Restart service
docker-compose restart
```

### Backup Data

```bash
# If using database (future)
docker-compose exec db pg_dump -U postgres > backup.sql

# Store logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz /var/log/clickfiller/

# Upload to safe location
# scp logs-backup-*.tar.gz user@backup-server:/backups/
```

### Cleanup

```bash
# Remove unused images
docker image prune -a

# Remove unused networks
docker network prune

# Remove unused volumes
docker volume prune

# View disk usage
docker system df
```

## Support

For issues or questions:

1. Check logs: `docker-compose logs -f`
2. Verify configuration: `cat .env | grep -v ANTHROPIC_API_KEY`
3. Check status: `docker-compose ps`
4. Review this guide: Troubleshooting section above
5. Contact: Include logs and error messages

## Security Checklist

- [ ] .env file created with ANTHROPIC_API_KEY
- [ ] .env file NOT committed to git (.gitignore updated)
- [ ] SSH key configured for Digital Ocean access
- [ ] Firewall allows ports 80 and 443 only
- [ ] SSL certificate installed and auto-renewal enabled
- [ ] Docker containers run as non-root user
- [ ] Regular security updates: `apt update && apt upgrade -y`
- [ ] Logs monitored regularly
- [ ] Backups of critical data stored securely
