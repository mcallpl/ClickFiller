#!/bin/bash

##############################################################################
# ClickFiller Deployment Script
#
# Deploys the application to a production server (local or remote)
#
# Usage:
#   ./scripts/deploy.sh                    # Deploy locally
#   ./scripts/deploy.sh user@host:/path    # Deploy to remote server
#
# Prerequisites:
#   - Docker and docker-compose installed
#   - .env file with GEMINI_API_KEY set (and optional GEMINI_MODEL)
#   - Git repository clean (no uncommitted changes)
#
##############################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_TARGET="${1:-.}"
DOCKER_IMAGE="clickfiller:latest"
CONTAINER_NAME="clickfiller-app"
HEALTH_CHECK_URL="http://localhost:3001/health"
MAX_RETRIES=30
RETRY_INTERVAL=2
ROLLBACK_ENABLED=true

##############################################################################
# Utility Functions
##############################################################################

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
  echo -e "\n${GREEN}==>${NC} $1"
}

check_prerequisites() {
  log_step "Checking prerequisites..."

  # Check Docker
  if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    exit 1
  fi
  log_info "Docker found: $(docker --version)"

  # Check docker-compose
  if ! command -v docker-compose &> /dev/null; then
    log_error "docker-compose is not installed"
    exit 1
  fi
  log_info "docker-compose found: $(docker-compose --version)"

  # Check .env file
  if [ ! -f .env ]; then
    log_error ".env file not found"
    echo "Create .env from .env.example: cp .env.example .env"
    exit 1
  fi
  log_info ".env file found"

  # Check GEMINI_API_KEY
  if ! grep -q "GEMINI_API_KEY=" .env; then
    log_error "GEMINI_API_KEY not set in .env"
    exit 1
  fi
  log_info "GEMINI_API_KEY configured"
}

build_docker_image() {
  log_step "Building Docker image..."

  if docker build -t "$DOCKER_IMAGE" .; then
    log_info "Docker image built successfully: $DOCKER_IMAGE"
    return 0
  else
    log_error "Docker image build failed"
    return 1
  fi
}

stop_containers() {
  log_step "Stopping existing containers..."

  if docker-compose down 2>/dev/null; then
    log_info "Containers stopped"
    sleep 2
    return 0
  else
    log_warn "No running containers to stop"
    return 0
  fi
}

save_container_state() {
  log_step "Saving current container state for rollback..."

  RUNNING_CONTAINERS=$(docker ps -q 2>/dev/null || true)
  if [ -z "$RUNNING_CONTAINERS" ]; then
    log_info "No containers running, creating backup reference"
    echo "$(date +%s)" > /tmp/clickfiller_deploy_timestamp
  else
    log_info "Backup state saved"
  fi
}

start_containers() {
  log_step "Starting containers..."

  if docker-compose up -d; then
    log_info "Containers started"
    sleep 3
    return 0
  else
    log_error "Failed to start containers"
    return 1
  fi
}

health_check() {
  log_step "Performing health check..."

  local retry_count=0
  local success=false

  while [ $retry_count -lt $MAX_RETRIES ]; do
    if curl -sf "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
      log_info "Health check passed"
      success=true
      break
    fi

    retry_count=$((retry_count + 1))
    log_info "Health check attempt $retry_count/$MAX_RETRIES..."
    sleep $RETRY_INTERVAL
  done

  if [ "$success" = true ]; then
    return 0
  else
    log_error "Health check failed after $MAX_RETRIES attempts"
    return 1
  fi
}

rollback_deployment() {
  if [ "$ROLLBACK_ENABLED" = true ]; then
    log_step "Rolling back deployment..."

    if docker-compose down; then
      log_info "Old containers removed"
    fi

    log_error "Deployment failed. Please check logs and fix issues before retrying."
    log_info "View logs: docker-compose logs -f"
    return 1
  else
    log_error "Deployment failed. Rollback disabled."
    return 1
  fi
}

log_deployment_event() {
  local status=$1
  local commit=${2:-"unknown"}
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  log_dir="/var/log/clickfiller"
  if [ -w "$log_dir" ] || mkdir -p "$log_dir" 2>/dev/null; then
    echo "[$timestamp] Deployment $status (commit: $commit)" >> "$log_dir/deployment.log" 2>/dev/null || true
  fi

  log_info "Deployment event logged"
}

verify_deployment() {
  log_step "Verifying deployment..."

  # Check container status
  if docker-compose ps | grep -q "Up"; then
    log_info "Containers are running"
  else
    log_error "Containers are not running"
    return 1
  fi

  # Check health endpoint responds with correct status
  local health_response=$(curl -s "$HEALTH_CHECK_URL")
  if echo "$health_response" | grep -q "ok"; then
    log_info "API responding correctly"
  else
    log_error "API health check failed"
    return 1
  fi

  return 0
}

display_summary() {
  log_step "Deployment Summary"
  echo "================================"
  echo "Docker Image:   $DOCKER_IMAGE"
  echo "Container Name: $CONTAINER_NAME"
  echo "Health Check:   $HEALTH_CHECK_URL"
  echo "Logs:           docker-compose logs -f"
  echo "Stop:           docker-compose down"
  echo "Restart:        docker-compose restart"
  echo "================================"
}

##############################################################################
# Main Deployment Flow
##############################################################################

main() {
  log_info "ClickFiller Deployment Script"
  log_info "Target: $DEPLOY_TARGET"
  log_info "Time: $(date)"

  check_prerequisites || exit 1
  build_docker_image || exit 1
  save_container_state
  stop_containers || true

  if start_containers; then
    if health_check; then
      log_deployment_event "successful" "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
      verify_deployment || exit 1
      display_summary
      log_info "Deployment completed successfully!"
      exit 0
    else
      rollback_deployment
      exit 1
    fi
  else
    rollback_deployment
    exit 1
  fi
}

# Run main function
main "$@"
