# Docker 部署说明

## 快速开始

### 1. 构建并启动服务

```bash
# 构建并启动（前台运行）
docker-compose up --build

# 或者后台运行
docker-compose up -d --build
```

### 2. 查看运行状态

```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 查看最近100行日志
docker-compose logs --tail=100
```

### 3. 停止服务

```bash
# 停止服务
docker-compose down

# 停止并删除卷（会删除数据）
docker-compose down -v
```

## 数据持久化

所有数据存储在 `./data` 目录下：

```
data/
├── domains.db                 # 域名数据库
├── certificate_checks.db      # 证书检查记录
├── notifications.db           # 通知发送记录
└── notification-config.json   # 通知配置（企业微信、消息模板）
```

**⚠️ 重要**：请定期备份 `data` 目录，避免数据丢失。

## 环境变量配置

可以通过环境变量快速配置企业微信 Webhook：

### 方式 1：在 docker-compose.yml 中设置

编辑 `docker-compose.yml` 文件：

```yaml
environment:
  - WECHAT_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY
```

### 方式 2：使用 .env 文件

在项目根目录创建 `.env` 文件：

```env
WECHAT_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY
```

然后在 `docker-compose.yml` 中引用：

```yaml
environment:
  - WECHAT_WEBHOOK_URL=${WECHAT_WEBHOOK_URL}
```

## 常用命令

```bash
# 重新构建镜像（不使用缓存）
docker-compose build --no-cache

# 重启服务
docker-compose restart

# 查看容器资源使用情况
docker stats ssl-certificate-monitor

# 进入容器内部
docker exec -it ssl-certificate-monitor sh

# 备份数据
tar -czf ssl-monitor-backup-$(date +%Y%m%d).tar.gz data/

# 恢复数据
tar -xzf ssl-monitor-backup-20240101.tar.gz
```

## 健康检查

容器内置健康检查，每30秒检查一次服务状态：

```bash
# 查看健康状态
docker inspect --format='{{.State.Health.Status}}' ssl-certificate-monitor

# 查看健康检查历史
docker inspect --format='{{json .State.Health}}' ssl-certificate-monitor | jq
```

健康状态说明：
- `healthy` - 服务正常
- `unhealthy` - 服务异常
- `starting` - 服务启动中

## 日志管理

容器日志配置为自动轮转：
- 单个日志文件最大 10MB
- 最多保留 3 个日志文件

### 查看日志

```bash
# 查看所有日志
docker-compose logs

# 实时查看日志
docker-compose logs -f

# 查看最近50行日志
docker-compose logs --tail=50

# 查看特定时间段的日志
docker-compose logs --since 2024-01-01T00:00:00
```

## 更新应用

```bash
# 1. 拉取最新代码
git pull

# 2. 备份数据（可选但推荐）
tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz data/

# 3. 重新构建并启动
docker-compose up -d --build

# 4. 查看日志确认启动成功
docker-compose logs -f
```

## 故障排查

### 容器无法启动

```bash
# 查看详细错误信息
docker-compose logs

# 检查端口是否被占用
# Linux
netstat -tunlp | grep 3001
# Windows
netstat -ano | findstr :3001

# 检查数据目录权限
ls -la data/
```

### 数据库损坏

```bash
# 1. 停止服务
docker-compose down

# 2. 恢复备份
tar -xzf your-backup.tar.gz

# 3. 重启服务
docker-compose up -d
```

### 无法访问服务

```bash
# 检查容器是否运行
docker-compose ps

# 检查容器网络
docker network ls
docker network inspect ssl-certificate-monitor_ssl-monitor-network

# 检查防火墙（Linux）
# CentOS/RHEL
firewall-cmd --list-ports

# Ubuntu
sudo ufw status
```

### 常见问题

**Q: 端口被占用怎么办？**

修改 `docker-compose.yml` 中的端口映射：

```yaml
ports:
  - "3002:3001"  # 将外部端口改为 3002
```

**Q: 如何修改提醒阈值默认值？**

在 Web 界面中修改每个域名的提醒阈值，或通过 API 修改。

**Q: 如何更换企业微信机器人？**

1. 在 Web 界面的"通知设置"页面更新 Webhook URL
2. 或通过环境变量设置：`WECHAT_WEBHOOK_URL`

**Q: 数据存储在哪里？**

所有数据存储在宿主机的 `./data` 目录，容器删除后数据不会丢失。

## 性能优化

### 限制容器资源

在 `docker-compose.yml` 中添加资源限制：

```yaml
services:
  ssl-monitor:
    deploy:
      resources:
        limits:
          cpus: '0.5'        # 限制最多使用 0.5 个 CPU
          memory: 512M       # 限制最多使用 512MB 内存
        reservations:
          memory: 256M       # 预留 256MB 内存
```

### 调整 Node.js 内存限制

```yaml
environment:
  - NODE_OPTIONS=--max-old-space-size=384
```

## 安全建议

### 1. 使用非 root 用户（已配置）

Dockerfile 已配置使用 `node` 用户运行，不使用 root 用户。

### 2. 定期更新基础镜像

```bash
# 拉取最新基础镜像并重新构建
docker-compose build --pull --no-cache
```

### 3. 备份数据

定期备份 `data` 目录：

```bash
# 每日备份脚本示例
#!/bin/bash
DATE=$(date +%Y%m%d)
tar -czf /backup/ssl-monitor-$DATE.tar.gz /path/to/ssl-certificate-monitor/data/
# 删除30天前的备份
find /backup -name "ssl-monitor-*.tar.gz" -mtime +30 -delete
```

### 4. 限制端口访问

只允许可信 IP 访问 3001 端口：

```bash
# Linux 防火墙规则示例
# 只允许 192.168.1.0/24 网段访问
iptables -A INPUT -p tcp -s 192.168.1.0/24 --dport 3001 -j ACCEPT
iptables -A INPUT -p tcp --dport 3001 -j DROP
```

### 5. 使用 HTTPS

在生产环境中，建议使用反向代理（如 Nginx）配置 HTTPS。

## 生产环境部署示例

### 使用 Nginx 反向代理 + HTTPS

#### 1. 创建 Nginx 配置文件

```nginx
# /etc/nginx/conf.d/ssl-monitor.conf

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name your-domain.com;
    
    # 强制 HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS 配置
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL 证书配置
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # SSL 优化配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # 反向代理配置
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 支持（如果需要）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # 访问日志
    access_log /var/log/nginx/ssl-monitor-access.log;
    error_log /var/log/nginx/ssl-monitor-error.log;
}
```

#### 2. 重启 Nginx

```bash
# 测试配置
nginx -t

# 重启 Nginx
systemctl restart nginx
```

### 使用 Let's Encrypt 免费证书

#### 1. 安装 Certbot

```bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx
```

#### 2. 申请证书

```bash
sudo certbot --nginx -d your-domain.com
```

#### 3. 自动续期

```bash
# 测试续期
sudo certbot renew --dry-run

# 添加到定时任务自动续期
sudo crontab -e
```

添加以下内容：

```cron
# 每周一凌晨2点尝试续期
0 2 * * 1 /usr/bin/certbot renew --quiet --post-hook "systemctl reload nginx"
```

## 监控和告警

### 容器监控

```bash
# 实时查看资源使用
docker stats ssl-certificate-monitor

# 查看容器详细信息
docker inspect ssl-certificate-monitor

# 查看容器进程
docker top ssl-certificate-monitor
```

### 使用 Prometheus + Grafana 监控（可选）

可以通过 Prometheus 收集容器指标：

```yaml
# docker-compose.yml 添加
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
```

## 备份和恢复

### 自动备份脚本

创建备份脚本 `backup.sh`：

```bash
#!/bin/bash

# 配置
BACKUP_DIR="/backup/ssl-monitor"
DATA_DIR="/path/to/ssl-certificate-monitor/data"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/ssl-monitor-$DATE.tar.gz"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据
tar -czf $BACKUP_FILE -C $(dirname $DATA_DIR) $(basename $DATA_DIR)

# 删除30天前的备份
find $BACKUP_DIR -name "ssl-monitor-*.tar.gz" -mtime +30 -delete

echo "备份完成: $BACKUP_FILE"
```

设置定时任务：

```bash
# 编辑定时任务
crontab -e

# 每天凌晨2点执行备份
0 2 * * * /path/to/backup.sh
```

### 恢复数据

```bash
# 1. 停止服务
docker-compose down

# 2. 解压备份文件
tar -xzf ssl-monitor-backup.tar.gz

# 3. 启动服务
docker-compose up -d
```

## 技术支持

如有问题，请查看：

1. **容器日志**：`docker-compose logs -f`
2. **应用日志**：查看容器标准输出
3. **数据库文件**：检查 `data/` 目录下的 `.db` 文件
4. **配置文件**：检查 `data/notification-config.json`

## 相关文档

- [启动说明.md](./启动说明.md) - 本地开发环境启动说明
- [通知配置说明.md](./通知配置说明.md) - 通知功能配置说明
- [README.md](./README.md) - 项目总体说明
