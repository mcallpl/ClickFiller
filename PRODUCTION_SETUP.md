# ClickFiller Production Setup Guide

Complete reference for production deployment infrastructure created in Phase 2.

## What's Included

This guide covers the production-ready deployment infrastructure for ClickFiller. All components are designed to work together to provide a secure, scalable, and maintainable deployment.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│             Internet / Users                     │
└──────────────────┬──────────────────────────────┘
                   │
                   ↓
        ┌──────────────────────┐
        │  nginx (Port 80/443) │  ← Reverse Proxy
        │  - SSL/TLS           │  ← Security Headers
        │  - Load Balancing    │  ← Caching
        └──────────────┬───────┘
                       │
           ┌───────────┴───────────┐
           ↓                       ↓
   ┌──────────────────┐   ┌──────────────────┐
   │   App Container  │   │ App Container 2* │
   │  - Node.js       │   │  (scaling)       │
   │  - Express       │   └──────────────────┘
   │  - PM2 (alt)     │
   └────────┬─────────┘
            │
            ↓
   ┌──────────────────┐
   │  Docker Network  │
   │  - Volume Mounts │
   │  - Service Mesh  │
   └──────────────────┘

* Future: Multiple instances for high availability
```

## Files Created (10 Deliverables)

### 1. Docker Configuration (Production-Grade Multi-Stage)

**File**: `/Dockerfile`
- Multi-stage build for optimized image size
- Node.js 20 LTS (latest stable)
- Non-root user (security hardening)
- Health check endpoint (30s interval)
- Graceful shutdown handling (SIGTERM)
- Production dependencies only

**Key Features**:
- Smaller final image (builder stage discarded)
- Security: Non-root user runs application
- Reliability: Built-in health check
- Proper signal handling for container orchestration

### 2. Docker Compose Configuration

**File**: `/docker-compose.yml`
- Multi-service orchestration (app + nginx)
- Volume mounts (read-only in production)
- Environment variable loading from .env
- Restart policy (unless-stopped)
- Resource limits (512MB memory, 0.5 CPU)
- Logging configuration with rotation
- Health checks for both services
- Named network for service communication

**Key Features**:
- Single command deployment: `docker-compose up -d`
- Automatic restart on crash
- Resource constraints prevent runaway processes
- Centralized logging with rotation
- Service discovery via DNS

### 3. Nginx Reverse Proxy

**File**: `/nginx/clickfiller.conf`
- HTTP listener on port 80
- Proxy to app service on port 3001
- Security headers (HSTS, CSP, X-Frame-Options)
- Gzip compression for bandwidth savings
- Static asset caching (1 year for immutable files)
- Request timeouts (60s for API calls)
- Large file upload support (20MB)
- Frontend routing (SPA support)

**Key Features**:
- Single responsibility principle
- Performance: Compression + caching
- Security: Multiple security headers
- Reliability: Request timeouts + error handling

### 4. SSL/TLS Configuration

**File**: `/nginx/ssl.conf`
- HTTP → HTTPS redirect (when enabled)
- Let's Encrypt certificate paths
- Modern TLS protocol suite (1.2+, 1.3)
- Strong cipher selection
- HSTS header (31536000s = 1 year)
- OCSP stapling for certificate validation

**Key Features**:
- Production-ready SSL/TLS configuration
- Automatic redirect to HTTPS
- Modern security standards
- Certificate auto-renewal compatible

### 5. GitHub Actions CI/CD Pipeline

**File**: `/.github/workflows/deploy.yml`
- Automated build and test on push to main
- Node.js 20 setup with dependency caching
- Linter execution (with fallback)
- Test suite with coverage
- Frontend build verification
- Docker image build and test
- Health endpoint validation
- Manual deployment trigger

**Key Features**:
- Zero-configuration deployment readiness
- Automated quality gates
- Docker image testing before deployment
- Notification ready (build status visible)

### 6. PM2 Ecosystem Configuration

**File**: `/ecosystem.config.js`
- Alternative deployment method (without Docker)
- Cluster mode (uses all available CPU cores)
- Automatic restart on crash
- Memory limit enforcement (512MB)
- Log file configuration
- Auto-start on server reboot (`pm2 startup`)
- Production environment template
- Graceful shutdown (10s timeout)

**Key Features**:
- Zero-downtime reloads in cluster mode
- Memory leak protection
- Process monitoring and restart
- Suitable for Digital Ocean droplets

### 7. Environment Configuration Template

**File**: `/.env.example`
- Documented environment variables
- Default values for development
- Production placeholders
- Comments for each variable
- Future feature flags
- Database connection template

**Key Features**:
- Copy template to create .env
- Clear documentation
- Safe defaults
- Never commit actual .env to git

### 8. Deployment Script

**File**: `/scripts/deploy.sh`
- Prerequisites verification (Docker, docker-compose, .env)
- Build Docker image from source
- Save container state for rollback
- Zero-downtime shutdown
- Health check validation (30 attempts)
- Automatic rollback on failure
- Deployment logging
- Colored output for visibility

**Key Features**:
- Idempotent (safe to run multiple times)
- Built-in rollback on failure
- Health check verification
- Detailed logging for troubleshooting

### 9. Deployment & Operations Documentation

**File**: `/DEPLOYMENT.md`
- 9-section guide for production deployment
- Local testing instructions
- Digital Ocean droplet setup steps
- SSL/TLS configuration with Certbot
- Three deployment options (script, manual, GitHub Actions)
- Monitoring and log viewing
- Troubleshooting common issues
- Rollback procedures
- Security checklist

**Key Features**:
- Step-by-step instructions
- Multiple deployment methods
- Complete troubleshooting section
- Real-world examples

### 10. Operations Runbook

**File**: `/RUNBOOK.md`
- Quick reference for daily operations
- Start/Stop/Restart commands
- Log viewing examples
- Resource monitoring
- Deployment procedures
- Troubleshooting flowcharts
- Emergency procedures
- Common command reference table

**Key Features**:
- Quick lookup format
- Emergency procedures
- Common commands reference
- Escalation paths

## Monitoring & Logging Infrastructure

### 11. Prometheus Configuration

**File**: `/monitoring/prometheus.yml`
- Health endpoint scraping (30s interval)
- Node metrics collection
- Docker metrics (optional)
- Alert rules configuration
- Targets for monitoring setup

### 12. Uptime Monitoring Script

**File**: `/monitoring/uptime-check.js`
- Periodic health check pinging
- Consecutive failure tracking
- Alert threshold configuration
- Slack webhook integration (optional)
- Email alerts (optional)
- Automatic log rotation
- Cooldown period between alerts (5 minutes)

### 13. Log Aggregation Guide

**File**: `/monitoring/log-aggregation.md`
- 4 log aggregation options:
  1. File-based (default)
  2. ELK Stack (Elasticsearch, Logstash, Kibana)
  3. Loki (Grafana Loki)
  4. Cloudflare Logpush
- Log retention strategies
- Cleanup procedures
- Troubleshooting guide

## Additional Changes

### Updated .gitignore

Enhanced with:
- All environment files (.env variants)
- Log files and directories
- SSL certificates and keys
- Docker overrides
- OS-specific files
- Monitoring cache directories
- Backup archives

## Deployment Checklist

### Prerequisites
- [ ] Docker 20.10+ installed on target machine
- [ ] docker-compose 2.0+ installed
- [ ] Git repository cloned
- [ ] ANTHROPIC_API_KEY obtained from Anthropic console
- [ ] Domain name registered (for production SSL)

### Local Testing
- [ ] `cp .env.example .env` - Create .env from template
- [ ] Edit .env with ANTHROPIC_API_KEY
- [ ] `docker build -t clickfiller:latest .` - Build image
- [ ] `docker-compose up -d` - Start services
- [ ] `curl http://localhost/health` - Verify health check
- [ ] Access http://localhost in browser - Verify frontend
- [ ] Test full workflow (save profile → upload form → fill → download PDF)
- [ ] `docker-compose logs -f` - Monitor logs during testing

### Digital Ocean Deployment
- [ ] Create Digital Ocean droplet (2GB RAM, Ubuntu 22.04)
- [ ] SSH into droplet
- [ ] Install Docker and docker-compose
- [ ] Clone repository
- [ ] Create .env with production API key
- [ ] Setup domain DNS records
- [ ] Install Let's Encrypt certificates with Certbot
- [ ] Run `./scripts/deploy.sh`
- [ ] Verify application is running
- [ ] Setup monitoring/logging

### Production Verification
- [ ] Health check responds: `curl https://yourdomain.com/health`
- [ ] Frontend accessible: https://yourdomain.com
- [ ] API endpoint reachable: `curl -X POST https://yourdomain.com/api/analyze`
- [ ] SSL certificate valid: Check browser padlock
- [ ] Logs are being written: `docker-compose logs`
- [ ] Resource usage is normal: `docker stats`
- [ ] Auto-restart on failure: Kill container and observe restart
- [ ] Rollback works: Revert commit and run deploy script

## Success Criteria (All Met)

✅ Docker image builds without errors
✅ Docker runs locally with docker-compose
✅ Health endpoint responds with HTTP 200
✅ Nginx proxies requests correctly
✅ Application accessible via http://localhost
✅ GitHub Actions pipeline executes
✅ Tests pass in CI/CD environment
✅ Docker image builds in CI/CD
✅ Deployment script works locally
✅ SSL configuration ready (Let's Encrypt compatible)
✅ Operations runbook created
✅ No secrets in git (updated .gitignore)
✅ Logging configured with rotation

## Quick Start Commands

### Local Development Testing
```bash
cp .env.example .env
nano .env  # Add ANTHROPIC_API_KEY
docker-compose up -d
curl http://localhost/health
docker-compose logs -f
docker-compose down
```

### Deploy to Digital Ocean
```bash
ssh root@<droplet-ip>
cd /app/clickfiller
./scripts/deploy.sh
curl http://localhost/health
```

### View Logs
```bash
docker-compose logs -f          # All services
docker-compose logs -f app      # App only
docker-compose logs -f nginx    # Nginx only
docker-compose logs --tail=100  # Last 100 lines
```

### Restart Services
```bash
docker-compose restart          # All services
docker-compose restart app      # App only
docker-compose stop && docker-compose start  # Full restart
```

### Monitor Resources
```bash
docker stats                    # Live stats
docker system df               # Disk usage
free -h                        # Memory usage
```

## Directory Structure

```
/ClickFiller
├── Dockerfile                 # Multi-stage build config
├── docker-compose.yml         # Service orchestration
├── .env.example              # Environment template
├── .gitignore                # Updated with secrets
├── nginx/
│   ├── clickfiller.conf      # HTTP config
│   └── ssl.conf              # HTTPS config
├── scripts/
│   └── deploy.sh             # Deployment automation
├── .github/
│   └── workflows/
│       └── deploy.yml        # CI/CD pipeline
├── monitoring/
│   ├── prometheus.yml        # Prometheus config
│   ├── uptime-check.js       # Health monitor
│   └── log-aggregation.md    # Logging guide
├── ecosystem.config.js        # PM2 config (alternative)
├── DEPLOYMENT.md             # Full deployment guide
├── RUNBOOK.md                # Operations reference
└── PRODUCTION_SETUP.md       # This file
```

## Next Steps

1. **Test Locally**: Follow "Local Development Testing" above
2. **Create Digital Ocean Droplet**: 2GB RAM minimum, Ubuntu 22.04
3. **Initial Deployment**: SSH in and run `./scripts/deploy.sh`
4. **Setup SSL**: Run Certbot for Let's Encrypt certificates
5. **Configure Monitoring**: Setup Prometheus or Loki if desired
6. **Enable Auto-Scaling**: Add more app instances for load balancing
7. **Setup Backups**: Configure database backups when DB is added
8. **Document Changes**: Keep RUNBOOK.md updated as procedures change

## Security Notes

- API keys are environment variables, never committed to git
- Nginx enforces security headers (CSP, HSTS, etc.)
- Docker runs as non-root user (nodejs)
- SSL/TLS enforced in production
- Large file uploads limited to 20MB
- Database credentials go in .env only

## Support & Troubleshooting

1. Check `/RUNBOOK.md` for quick solutions
2. Review `/DEPLOYMENT.md` troubleshooting section
3. Check container logs: `docker-compose logs -f`
4. Check health endpoint: `curl http://localhost/health`
5. Verify .env is set: `cat .env | grep ANTHROPIC_API_KEY`
6. Review Docker Compose: `docker-compose config`

## Version History

- **v1.0** (2024-06-21): Initial Phase 2 production infrastructure
  - All 10 deliverables completed
  - Docker + nginx configuration
  - GitHub Actions CI/CD
  - PM2 alternative
  - SSL/TLS ready
  - Monitoring & logging
  - Complete documentation

---

**Last Updated**: 2024-06-21
**Created By**: DevOps Specialist - Phase 2
**Status**: ✅ Production Ready
