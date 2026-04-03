const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const db = require('./db/database');
const scheduleManager = require('./utils/scheduleManager');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../static')));

app.use('/api', routes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 初始化数据库
async function initializeApp() {
  try {
    await db.initialize();
    console.log('数据库初始化成功');

    // 启动定时任务
    scheduleManager.start();

    app.listen(PORT, () => {
      console.log(`\n✓ SSL 证书监控系统已启动`);
      console.log(`✓ 后端服务: http://localhost:${PORT}`);
      console.log(`✓ 前端界面: http://localhost:${PORT}`);
      console.log(`\n按 Ctrl+C 停止服务\n`);
    });
  } catch (error) {
    console.error('应用启动失败:', error);
    process.exit(1);
  }
}

initializeApp();

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n正在关闭服务器...');
  scheduleManager.stop();
  await db.close();
  process.exit(0);
});
