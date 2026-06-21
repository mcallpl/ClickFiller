# ClickFiller Operations Runbook

Quick reference for day-to-day operations and emergency procedures.

## Daily Operations

### Start the Application

```bash
# Navigate to app directory
cd /app/clickfiller

# Start all services
docker-compose up -d

# Verify all services are running
docker-compose ps

# Check health
curl http://localhost/health
```

### Stop the Application

```bash
cd /app/clickfiller

# Graceful shutdown (recommended)
docker-compose stop

# Force shutdown (if necessary)
docker-compose kill
```

### Restart Application

```bash
cd /app/clickfiller

# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart app
docker-compose restart nginx

# Wait and verify
sleep 5
curl http://localhost/health
```

### View Logs

```bash
cd /app/clickfiller

# Real-time logs (all services)
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Specific service
docker-compose logs -f app
docker-compose logs -f nginx

# Filter by keyword
docker-compose logs | grep "error"

# Export logs to file
docker-compose logs > logs-export.txt
```

### Monitor Resource Usage

```bash
# Live monitoring (similar to 'top')
docker stats

# One-time snapshot
docker stats --no-stream

# Check disk space
df -h

# Check memory
free -h

# Check specific container
docker-compose top app
```

## Deployment

### Deploy New Version

```bash
cd /app/clickfiller

# Option 1: Using deployment script (recommended)
./scripts/deploy.sh

# Option 2: Manual steps
git pull origin main
docker build -t clickfiller:latest .
docker-compose down
docker-compose up -d
sleep 10
curl http://localhost/health
```

### Deploy from Specific Commit

```bash
cd /app/clickfiller

# Checkout specific commit
git checkout <commit-hash>

# Deploy
./scripts/deploy.sh

# Or revert to latest main
git checkout main
./scripts/deploy.sh
```

### Deploy Specific Branch

```bash
cd /app/clickfiller

# Fetch and checkout branch
git fetch origin
git checkout origin/<branch-name>

# Deploy
./scripts/deploy.sh
```

## Troubleshooting

### Application Won't Start

```bash
# Step 1: Check logs
docker-compose logs app | head -50

# Step 2: Verify prerequisites
docker-compose ps
docker-compose config

# Step 3: Check .env file
cat .env | head -10
# Verify ANTHROPIC_API_KEY is set

# Step 4: Rebuild without cache
docker build --no-cache -t clickfiller:latest .
docker-compose up -d

# Step 5: If still failing
# Check system resources
docker system df
free -h
df -h
```

### Health Check Failing

```bash
# Step 1: Test directly
docker-compose exec app curl http://localhost:3001/health

# Step 2: Check logs
docker-compose logs app

# Step 3: Verify port is listening
docker-compose exec app netstat -an | grep 3001

# Step 4: Restart service
docker-compose restart app
```

### Nginx Not Proxying Requests

```bash
# Step 1: Check nginx logs
docker-compose logs nginx

# Step 2: Verify app is reachable from nginx
docker-compose exec nginx curl http://app:3001/health

# Step 3: Check nginx config
docker-compose exec nginx nginx -t

# Step 4: Reload nginx config
docker-compose exec nginx nginx -s reload
```

### High Memory Usage

```bash
# Step 1: Check usage
docker stats

# Step 2: Identify process
docker-compose top app

# Step 3: Check for memory leaks
docker-compose logs app | grep -i "memory\|leak\|heap"

# Step 4: Restart container
docker-compose restart app

# Step 5: If persistent
# Increase memory limit in docker-compose.yml
# restart service
```

### API Key Invalid

```bash
# Step 1: Check if key is set
docker-compose exec app printenv ANTHROPIC_API_KEY

# Step 2: Verify key format (should start with sk-)
# If blank, key not loaded

# Step 3: Update .env
nano .env
# Set correct ANTHROPIC_API_KEY

# Step 4: Restart app
docker-compose restart app

# Step 5: Test
curl http://localhost:3001/health
```

### SSL Certificate Issues

```bash
# Step 1: Check certificate status
certbot certificates

# Step 2: View cert details
openssl x509 -in /etc/letsencrypt/live/yourdomain.com/cert.pem -text -noout

# Step 3: Verify cert is loaded in nginx
curl -v https://yourdomain.com 2>&1 | grep "certificate"

# Step 4: Renew certificate
certbot renew --force-renewal

# Step 5: Restart nginx
docker-compose restart nginx
```

## Accessing Application

### Via HTTP (Local)
```bash
# Frontend
curl http://localhost

# API endpoint
curl -X POST http://localhost/api/analyze \
  -H "Content-Type: application/json" \
  -d '{...}'

# Health check
curl http://localhost/health
```

### Via HTTPS (Production)
```bash
# Frontend
https://yourdomain.com

# API endpoint
curl -X POST https://yourdomain.com/api/analyze

# Health check
curl https://yourdomain.com/health
```

### SSH Into Container

```bash
# Interactive shell in app
docker-compose exec app sh

# Run specific command
docker-compose exec app env

# Run Node REPL
docker-compose exec app node
```

## Database Operations (Future)

When database is added:

```bash
# Connect to database
docker-compose exec db psql -U postgres

# Backup database
docker-compose exec db pg_dump -U postgres > backup.sql

# Restore from backup
docker-compose exec -T db psql -U postgres < backup.sql

# Run migrations
docker-compose exec app npm run migrate
```

## Emergency Procedures

### Service Down - Immediate Recovery

```bash
# Step 1: Verify status
docker-compose ps

# Step 2: Restart
docker-compose restart

# Step 3: Verify recovery
sleep 5
curl http://localhost/health

# Step 4: If still down, check resources
docker system df
free -h
df -h

# Step 5: Full restart
docker-compose down
docker-compose up -d
sleep 10
curl http://localhost/health
```

### Disk Space Critical

```bash
# Step 1: Check usage
df -h

# Step 2: Clean up Docker
docker system prune -a

# Step 3: Check log sizes
du -sh /var/lib/docker/containers/*

# Step 4: If still critical, reduce log retention
# Edit docker-compose.yml, update logging options:
# max-size: "5m" (was 10m)
# max-file: "2" (was 3)
docker-compose restart

# Step 5: Monitor
watch df -h
```

### Memory Exhausted

```bash
# Step 1: Check what's using memory
docker stats
free -h

# Step 2: Stop non-critical services
docker-compose stop nginx  # if app is priority

# Step 3: Restart app
docker-compose restart app

# Step 4: Increase resources
# Edit docker-compose.yml under deploy > resources
docker-compose restart
```

### Port Already in Use

```bash
# Step 1: Find what's using port
lsof -i :80
lsof -i :443
lsof -i :3001

# Step 2: Kill process or change port
# Kill the process:
kill <pid>

# Or change port in docker-compose.yml:
# ports: "8080:3001" (use 8080 instead)

# Step 3: Restart
docker-compose restart
```

## Backups

### Manual Backup

```bash
# Create backup directory
mkdir -p /backups/clickfiller

# Backup current state
cp -r /app/clickfiller /backups/clickfiller/backup-$(date +%Y%m%d-%H%M%S)

# Backup logs
tar -czf /backups/logs-$(date +%Y%m%d).tar.gz /var/log/clickfiller/

# List backups
ls -lah /backups/
```

### Restore from Backup

```bash
# Stop services
docker-compose down

# Restore files
cp -r /backups/clickfiller/backup-<date>/* /app/clickfiller/

# Restart
docker-compose up -d
```

## Common Commands Reference

| Command | Purpose |
|---------|---------|
| `docker-compose up -d` | Start services in background |
| `docker-compose down` | Stop and remove services |
| `docker-compose restart` | Restart all services |
| `docker-compose ps` | List running services |
| `docker-compose logs -f` | View live logs |
| `docker-compose exec app sh` | SSH into app container |
| `docker build -t clickfiller:latest .` | Build Docker image |
| `docker system df` | Check Docker disk usage |
| `docker stats` | Monitor resource usage |
| `curl http://localhost/health` | Test health endpoint |

## Contacts & Escalation

- **Slack Channel**: #clickfiller-ops
- **PagerDuty**: [Link to on-call schedule]
- **GitHub Issues**: https://github.com/yourusername/clickfiller/issues
- **Email**: ops@yourdomain.com

## Updates & Changes

### Last Updated
- Date: 2024-01-20
- By: DevOps Team
- Changes: Initial runbook creation

### Version History
- v1.0 (2024-01-20) - Initial version
