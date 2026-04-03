# Dockerfile for SSL Certificate Monitor
# 使用官方 Node.js Alpine 镜像（更小更安全）
FROM node:21-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖（只安装生产环境依赖）
RUN npm ci --only=production && \
    npm cache clean --force

# 复制应用代码
COPY . .

# 创建数据目录并设置权限
RUN mkdir -p /app/data && \
    chown -R node:node /app

# 切换到非 root 用户（安全最佳实践）
USER node

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/domains', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动应用
CMD ["node", "server/index.js"]
