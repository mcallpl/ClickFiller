# ClickFiller Log Aggregation & Monitoring

Guide for setting up centralized logging and monitoring for ClickFiller.

## Current Logging Setup

By default, ClickFiller logs to Docker container stdout/stderr with automatic rotation:

```yaml
# docker-compose.yml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
```

This keeps logs local with automatic rotation (10MB max per file, 3 files retained).

## View Logs Locally

```bash
# Real-time logs
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f nginx

# Last 100 lines
docker-compose logs --tail=100

# With timestamps
docker-compose logs -f --timestamps
```

## Option 1: File-Based Logging (Recommended for Simple Setup)

### 1. Configure Log Files in docker-compose.yml

```yaml
volumes:
  - /var/log/clickfiller:/app/logs

logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"
    labels: "service=clickfiller"
```

### 2. Manual Log Rotation with Cron

Create `/etc/logrotate.d/clickfiller`:

```
/var/log/clickfiller/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
    sharedscripts
}
```

### 3. View Logs

```bash
# View application logs
tail -f /var/log/clickfiller/app.log
tail -f /var/log/clickfiller/error.log

# Search logs
grep "error" /var/log/clickfiller/*.log
grep -A 5 "Failed to" /var/log/clickfiller/*.log

# Real-time tail
watch tail -n 20 /var/log/clickfiller/app.log
```

## Option 2: ELK Stack (Elasticsearch, Logstash, Kibana)

### 1. Add Logstash Configuration

Create `docker-compose.elk.yml`:

```yaml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.0.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - es-data:/usr/share/elasticsearch/data

  logstash:
    image: docker.elastic.co/logstash/logstash:8.0.0
    volumes:
      - ./monitoring/logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    ports:
      - "5000:5000"
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.0.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch

volumes:
  es-data:
```

### 2. Create Logstash Configuration

Create `monitoring/logstash.conf`:

```
input {
  tcp {
    port => 5000
    codec => json
  }
}

filter {
  if [service] == "clickfiller" {
    mutate {
      add_field => { "[@metadata][index_name]" => "clickfiller-%{+YYYY.MM.dd}" }
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "%{[@metadata][index_name]}"
  }
}
```

### 3. Update Application Logging

Modify `server/index.js` to send logs to Logstash:

```javascript
import winston from 'winston';

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### 4. Start ELK Stack

```bash
# Start ELK
docker-compose -f docker-compose.yml -f docker-compose.elk.yml up -d

# Access Kibana
# http://localhost:5601
```

## Option 3: Loki (Grafana Loki)

Lightweight logging alternative using Grafana.

### 1. Docker Compose Configuration

```yaml
services:
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - ./monitoring/loki-config.yml:/etc/loki/local-config.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    depends_on:
      - loki
```

### 2. Send Logs from App

Configure Docker to use Loki:

```yaml
logging:
  driver: loki
  options:
    loki-url: "http://localhost:3100/loki/api/v1/push"
    loki-retries: "5"
    loki-batch-size: "400"
```

## Option 4: Cloudflare Logpush (Cloud-Native)

If using Cloudflare, send logs directly:

```bash
# Setup Logpush via Cloudflare Dashboard
# Logs are sent to your chosen destination (S3, Datadog, etc.)
```

## Monitoring & Alerting

### Application Health Metrics

The `/health` endpoint returns:

```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "service": "ClickFiller API"
}
```

### Prometheus Metrics

See `monitoring/prometheus.yml` for Prometheus configuration.

### Create Alerts

Example Prometheus alert rules in `monitoring/alert.rules.yml`:

```yaml
groups:
  - name: clickfiller
    interval: 30s
    rules:
      - alert: ClickFillerHealthCheckFailed
        expr: up{job="clickfiller-api"} == 0
        for: 2m
        annotations:
          summary: "ClickFiller health check failed"

      - alert: HighErrorRate
        expr: rate(errors_total[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
```

## Log Retention & Cleanup

### Docker Logs

```bash
# Check size
du -sh /var/lib/docker/containers/*/

# Prune old logs (keep last 30 days)
find /var/lib/docker/containers -name "*.log" -mtime +30 -delete

# Or set in docker-compose.yml
max-file: "5"  # Keep only 5 rotated files
max-size: "10m"  # Each file max 10MB
```

### Archive Old Logs

```bash
# Create archive
tar -czf logs-archive-$(date +%Y%m%d).tar.gz /var/log/clickfiller/

# Upload to S3
aws s3 cp logs-archive-*.tar.gz s3://your-bucket/logs/

# Clean up local
rm logs-archive-*.tar.gz
```

## Troubleshooting Log Issues

### Logs Not Being Written

```bash
# Check log directory permissions
ls -la /var/log/clickfiller/

# Check if container can write
docker-compose exec app touch /app/logs/test.log

# Check disk space
df -h /var/log/

# Increase max-file or max-size in docker-compose.yml
```

### Log Files Too Large

```bash
# Reduce log rotation sizes
# In docker-compose.yml:
max-size: "5m"  # Reduce from 10m
max-file: "3"   # Reduce from 5

# Restart to apply
docker-compose restart
```

### ELK Stack Issues

```bash
# Check Elasticsearch
curl http://localhost:9200/_health

# Check Logstash
docker-compose logs logstash

# Reset Elasticsearch data
docker volume rm clickfiller_es-data
docker-compose up -d elasticsearch
```

## Best Practices

1. **Log Levels**: Use appropriate levels (debug, info, warn, error)
2. **Structured Logging**: Include context (request ID, user ID, etc.)
3. **Retention**: Keep logs for 30+ days for compliance
4. **Archives**: Store old logs in S3/backup for audit trails
5. **Alerts**: Set up alerts for critical errors
6. **Privacy**: Don't log sensitive data (API keys, passwords)
7. **Performance**: Don't log on every request (sample if needed)

## Quick Reference

```bash
# View logs
docker-compose logs -f

# Search logs
docker-compose logs | grep "error"

# Real-time tail
docker-compose logs -f --tail=50

# Export logs
docker-compose logs > logs-export.txt

# Check log size
du -sh /var/lib/docker/containers/*/

# Clean logs
docker system prune -a

# Rotate logs manually
logrotate -f /etc/logrotate.d/clickfiller
```

## Further Reading

- Docker Logging: https://docs.docker.com/config/containers/logging/
- Prometheus: https://prometheus.io/docs/
- ELK Stack: https://www.elastic.co/what-is/elk-stack
- Loki: https://grafana.com/oss/loki/
- Log Best Practices: https://12factor.net/logs
