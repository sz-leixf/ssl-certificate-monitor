const cron = require('node-cron');
const db = require('../db/database');
const certificateChecker = require('./certificateChecker');
const wechatBot = require('./wechatBot');
const configManager = require('./configManager');

let scheduledTask = null;

// 获取定时配置
function getScheduleConfig() {
  const config = configManager.getConfig();
  const scheduleConfig = config.schedule || {};

  const result = {
    enabled: scheduleConfig.enabled !== false, // 默认启用
    days: scheduleConfig.days || 1,
    hour: scheduleConfig.hour || 6,
    minute: scheduleConfig.minute || 30
  };

  console.log('[定时任务配置]', result);
  return result;
}

// 生成 cron 表达式
function generateCronPattern(config) {
  // 分钟 小时 日期 月份 星期
  // 示例: 30 6 */1 * * 表示每天6点30分执行
  return `${config.minute} ${config.hour} */${config.days} * *`;
}

// 执行证书检查
async function checkCertificates() {
  console.log('\n=== 开始执行定时证书检查 ===', new Date().toLocaleString());
  try {
    const domains = await db.getAllDomains();
    console.log(`待检查域名数量: ${domains.length}`);

    for (const domain of domains) {
      if (!domain.enabled) continue;

      try {
        // 保存之前的状态用于比较
        // 非正常状态：证书无效 或 即将到期（剩余天数 <= 提醒阈值）
        const wasAbnormal = domain.is_valid !== null && (
          domain.is_valid !== true || 
          (domain.days_until_expiry !== null && domain.days_until_expiry <= domain.alert_days)
        );

        const result = await certificateChecker.checkCertificate(domain.name);
        await db.updateDomainCheck(domain.id, result);

        // 当前状态：证书有效 且 剩余天数 > 提醒阈值
        const isNowNormal = result.isValid === true && 
                            (result.daysUntilExpiry === undefined || result.daysUntilExpiry > domain.alert_days);

        // 如果证书异常，发送提醒
        if (!result.isValid || (result.daysUntilExpiry !== undefined && result.daysUntilExpiry <= domain.alert_days)) {
          console.log(`域名 ${domain.name} 证书异常，发送提醒...`);
          await wechatBot.sendAlert(domain, result);
        } 
        // 如果从非正常状态变为正常状态，发送成功通知
        else if (wasAbnormal && isNowNormal) {
          console.log(`域名 ${domain.name} 从非正常状态变为正常状态，发送成功通知`);
          await wechatBot.sendSuccessNotification(domain, result);
        }
      } catch (error) {
        console.error(`检查域名 ${domain.name} 失败:`, error.message);
        await db.updateDomainCheck(domain.id, {
          isValid: false,
          error: error.message,
          lastCheck: new Date().toISOString()
        });
      }
    }
    console.log('=== 定时证书检查完成 ===\n');
  } catch (error) {
    console.error('定时任务执行失败:', error);
  }
}

// 启动定时任务
function start() {
  const config = getScheduleConfig();

  if (!config.enabled) {
    console.log('定时检查任务已禁用');
    return;
  }

  if (scheduledTask) {
    stop();
  }

  const cronPattern = generateCronPattern(config);
  console.log(`启动定时证书检查任务: 每隔${config.days}天 ${config.hour}:${config.minute.toString().padStart(2, '0')} 执行一次`);

  scheduledTask = cron.schedule(cronPattern, checkCertificates, {
    scheduled: true,
    timezone: 'Asia/Shanghai'
  });

  console.log(`Cron 表达式: ${cronPattern}`);
}

// 停止定时任务
function stop() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('定时检查任务已停止');
  }
}

// 重启定时任务
function restart() {
  stop();
  start();
}

module.exports = {
  start,
  stop,
  restart,
  getScheduleConfig
};
