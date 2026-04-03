# SSL 证书监控管理系统

一个功能完善的 SSL 证书监控 Web 应用，支持域名管理、证书检测、定时提醒和企业微信通知等功能。

![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)
![Express](https://img.shields.io/badge/Express-4.18+-blue.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

## ✨ 功能特性

### 核心功能
- 📝 **域名管理**：添加、删除、编辑、批量导入监控域名列表
- 🔍 **证书检测**：自动检测 SSL 证书的有效期、颁发机构和状态
- ⏰ **定时提醒**：支持自定义提醒阈值（如到期前 30/10/7/3 天）
- 🔔 **企业微信通知**：通过企业微信群机器人发送证书到期提醒
- 📊 **可视化展示**：直观显示证书状态、到期时间和检查记录
- 🔒 **安全认证**：用户登录认证，修改密码，安全退出

### 高级功能
- 📥 **批量导入**：支持从文本文件批量导入域名
- 🔁 **批量操作**：批量检查、启用、禁用、删除和修改提醒阈值
- 🔍 **智能搜索**：支持域名搜索和结果筛选
- 📄 **分页显示**：支持大数据量的分页浏览
- 📈 **状态排序**：支持按域名、状态、到期时间等字段排序

### 系统特性
- 💾 **数据持久化**：使用 NeDB 数据库存储数据
- 🎨 **现代化界面**：简洁美观的响应式 UI 设计
- 🚀 **高性能**：单页应用，快速响应
- 🐳 **Docker 支持**：提供 Docker 部署方案

## 🚀 快速开始

### 环境要求

- Node.js 20+ 
- npm 9+
- Windows / Linux / macOS

### 安装依赖

```bash
# 安装后端依赖
npm install
```

### 启动项目

```bash
# 启动后端服务
npm start

# 访问系统
# 默认地址: http://localhost:3001
# 默认账号: admin / admin123
```

## 📖 使用指南

### 1. 登录系统

首次访问系统时，会显示登录页面：

- **用户名**: `admin`
- **密码**: `admin123`

> ⚠️ **安全提示**: 首次登录后建议立即修改默认密码

### 2. 添加域名

1. 点击左侧菜单的"添加域名"
2. 输入域名（如：example.com）
3. 设置提醒阈值（如：10天）
4. 选择是否启用监控
5. 点击"提交"按钮

系统会自动检查证书并显示结果。

### 3. 配置企业微信通知

1. 点击左侧菜单的"通知设置"
2. 在企业微信群中添加群机器人
3. 获取 Webhook 地址并填入
4. （可选）配置 @成员提醒
5. 点击"测试通知"验证配置
6. 点击"保存设置"

### 4. 设置定时检查

1. 点击左侧菜单的"定时设置"
2. 设置检查间隔（天）
3. 设置检查时间（时:分）
4. 点击"保存设置"

## 🔧 企业微信机器人配置

### 创建企业微信机器人

1. 在企业微信群中，点击右上角 "..." 菜单
2. 选择"添加群机器人"
3. 设置机器人名称和头像
4. 创建后获取 Webhook URL
5. 复制完整的 URL 到系统配置中

### Webhook URL 格式

```
https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY
```

### @成员配置

系统支持在通知时 @ 指定成员：

- **手机号**: 填写手机号，通知时会 @ 该成员
- **用户ID**: 填写企业微信用户ID，通知时会 @ 该成员
- **格式**: 多个成员用逗号分隔

示例：
```
手机号: 13800000000,13900000000
用户ID: user001,user002
```

## 📊 数据管理

### 数据存储

所有数据存储在 `data/` 目录下：

```
data/
├── domains.db                      # 域名列表
├── certificate_checks.db           # 证书检查记录
├── notifications.db                # 通知发送记录
├── notification-config.json        # 通知配置
└── auth-config.json               # 认证配置
```

### 数据备份

```bash
# 备份所有数据
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# 恢复数据
tar -xzf backup-20240101.tar.gz
```

## 🐳 Docker 部署

### 使用 Docker Compose

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

详细部署说明请参考 [docker部署说明.md](./docker部署说明.md)

## 🛠️ 开发指南

### 项目结构

```
ssl-certificate-monitor/
├── server/                      # 后端服务
│   ├── db/                      # 数据库模块
│   │   └── database.js          # NeDB 数据库操作
│   ├── routes/                  # API 路由
│   │   └── index.js             # 路由定义
│   └── utils/                   # 工具函数
│       ├── certificateChecker.js # 证书检测
│       ├── configManager.js     # 配置管理
│       ├── auth.js              # 认证模块
│       ├── scheduleManager.js   # 定时任务
│       └── wechatBot.js         # 企业微信通知
├── static/                      # 前端资源
│   └── index.html              # 单页应用
├── data/                       # 数据存储
├── package.json                # 依赖配置
└── docker-compose.yml         # Docker 配置
```

### API 接口

#### 认证相关

| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | /api/auth/login | 用户登录 |
| GET | /api/auth/status | 检查登录状态 |
| POST | /api/auth/logout | 退出登录 |
| POST | /api/auth/change-password | 修改密码 |

#### 域名管理

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | /api/domains | 获取所有域名 |
| POST | /api/domains | 添加域名 |
| PUT | /api/domains/:id | 更新域名 |
| DELETE | /api/domains/:id | 删除域名 |
| POST | /api/domains/:id/check | 手动检查证书 |
| POST | /api/domains/check-all | 批量检查所有域名 |

#### 通知配置

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | /api/notification/config/wechat | 获取企业微信配置 |
| PUT | /api/notification/config/wechat | 更新企业微信配置 |
| GET | /api/notification/config/templates | 获取所有消息模板 |
| POST | /api/test-notification | 发送测试通知 |

#### 定时配置

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | /api/schedule/config | 获取定时配置 |
| POST | /api/schedule/config | 更新定时配置 |

详细 API 文档请参考 [通知配置说明.md](./通知配置说明.md)

## 🔒 安全特性

### 密码安全
- 密码使用 SHA256 加密存储
- 支持修改密码
- 修改密码后强制重新登录

### 会话管理
- 登录状态自动检查
- 安全退出功能
- 会话状态持久化

### 数据安全
- 配置文件加密存储
- Webhook URL 保护
- 定期数据备份

## 📝 配置说明

### 定时检查配置

系统支持自动定时检查证书，可配置：

- **检查间隔**: 每隔几天检查一次（1-30天）
- **检查时间**: 每天的执行时间点（0-23时，0-59分）
- **是否启用**: 可随时启用/禁用定时检查

### 提醒阈值配置

每个域名可独立设置提醒阈值：

- **最小值**: 1 天
- **最大值**: 365 天
- **默认值**: 10 天

### 通知类型

系统提供多种通知类型：

- 🔔 **到期提醒**: 证书到期时发送
- 🚨 **已过期**: 证书已过期时发送
- ⚠️ **即将到期**: 证书即将到期（7天内）时发送
- ✅ **检查成功**: 证书从异常恢复正常时发送
- ❌ **检查失败**: 证书检查失败时发送

## 🎯 技术栈

### 后端
- **Node.js** - 运行时环境
- **Express** - Web 框架
- **NeDB** - 嵌入式数据库
- **node-cron** - 定时任务
- **axios** - HTTP 客户端
- **crypto** - 加密模块

### 前端
- **HTML5/CSS3** - 页面结构和样式
- **Vanilla JavaScript** - 原生 JavaScript
- **Fetch API** - 网络请求
- **Markdown** - 消息格式

### 部署
- **Docker** - 容器化部署
- **Docker Compose** - 多容器编排
- **Nginx** - 反向代理（可选）

## 📚 相关文档

- [启动说明.md](./启动说明.md) - 项目启动和配置说明
- [docker部署说明.md](./docker部署说明.md) - Docker 部署指南
- [通知配置说明.md](./通知配置说明.md) - 通知功能详细配置
- [管理员功能说明.md](./管理员功能说明.md) - 认证和安全管理

## ⚠️ 常见问题

### Q: 端口被占用怎么办？

**A**: 修改 `server/index.js` 中的端口号：

```javascript
const PORT = process.env.PORT || 3002; // 改为其他端口
```

### Q: 忘记密码怎么办？

**A**: 可以通过 API 重置密码：

```bash
curl -X POST http://localhost:3001/api/auth/reset-password
```

### Q: 证书检查超时怎么办？

**A**: 检查网络连接，或调整超时时间（默认 20 秒）：

```javascript
// server/utils/certificateChecker.js
req.setTimeout(30000); // 改为 30 秒
```

### Q: 企业微信通知未发送？

**A**: 检查以下项：
1. Webhook URL 是否正确
2. 通知开关是否开启
3. 域名是否启用监控
4. 查看后端日志中的错误信息

### Q: 如何批量导入域名？

**A**: 
1. 准备一个 `.txt` 文件，每行一个域名
2. 点击"批量导入"按钮
3. 选择文件并导入

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 📞 技术支持

如有问题或建议，请通过以下方式联系：

- 提交 Issue
- 查看文档
- 检查日志
- QQ：46190567

---

**最后更新**: 2026-04-02
**版本**: 1.0.0

