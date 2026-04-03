const express = require('express');
const router = express.Router();
const db = require('../db/database');
const certificateChecker = require('../utils/certificateChecker');
const wechatBot = require('../utils/wechatBot');
const configManager = require('../utils/configManager');
const auth = require('../utils/auth');

// 获取所有域名
router.get('/domains', async (req, res) => {
  try {
    const domains = await db.getAllDomains();
    res.json({ success: true, data: domains });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单个域名
router.get('/domains/:id', async (req, res) => {
  try {
    const domain = await db.getDomainById(req.params.id);
    if (!domain) {
      return res.status(404).json({ success: false, error: '域名不存在' });
    }
    res.json({ success: true, data: domain });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 添加域名
router.post('/domains', async (req, res) => {
  try {
    const { name, alert_days = 10, enabled = true } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: '域名不能为空' });
    }

    const domain = await db.createDomain({ name, alert_days, enabled });
    res.json({ success: true, data: domain });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      res.status(400).json({ success: false, error: '该域名已存在' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// 更新域名
router.put('/domains/:id', async (req, res) => {
  try {
    const { name, alert_days, enabled } = req.body;
    const domain = await db.updateDomain(req.params.id, { name, alert_days, enabled });
    res.json({ success: true, data: domain });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      res.status(400).json({ success: false, error: '该域名已存在' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// 删除域名
router.delete('/domains/:id', async (req, res) => {
  try {
    await db.deleteDomain(req.params.id);
    res.json({ success: true, message: '域名删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 手动检查证书
router.post('/domains/:id/check', async (req, res) => {
  try {
    const domain = await db.getDomainById(req.params.id);
    if (!domain) {
      return res.status(404).json({ success: false, error: '域名不存在' });
    }

    // 保存之前的状态用于比较
    // 非正常状态：证书无效 或 即将到期（剩余天数 <= 提醒阈值）
    const wasAbnormal = domain.is_valid !== null && (
      domain.is_valid !== true || 
      (domain.days_until_expiry !== null && domain.days_until_expiry <= domain.alert_days)
    );

    const result = await certificateChecker.checkCertificate(domain.name);
    await db.updateDomainCheck(req.params.id, result);

    // 当前状态：证书有效 且 剩余天数 > 提醒阈值
    const isNowNormal = result.isValid === true && 
                        (result.daysUntilExpiry === undefined || result.daysUntilExpiry > domain.alert_days);

    console.log(`[证书检查] ${domain.name}:`, {
      '之前': { is_valid: domain.is_valid, days_until_expiry: domain.days_until_expiry, alert_days: domain.alert_days },
      '当前': { isValid: result.isValid, daysUntilExpiry: result.daysUntilExpiry },
      '状态变化': { wasAbnormal, isNowNormal },
      '发送成功通知': domain.enabled && wasAbnormal && isNowNormal
    });

    // 如果证书已过期或即将到期（剩余天数小于提醒阈值），发送通知
    if (domain.enabled && (!result.isValid || (result.daysUntilExpiry !== undefined && result.daysUntilExpiry <= domain.alert_days))) {
      await wechatBot.sendAlert(domain, result);
    } 
    // 如果从非正常状态变为正常状态，发送成功通知
    else if (domain.enabled && wasAbnormal && isNowNormal) {
      console.log(`[证书状态变化] ${domain.name} 从非正常状态变为正常状态，发送成功通知`);
      await wechatBot.sendSuccessNotification(domain, result);
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 批量检查所有域名
router.post('/domains/check-all', async (req, res) => {
  try {
    const domains = await db.getAllDomains();
    const results = [];

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
        results.push({ domainId: domain.id, name: domain.name, ...result });

        // 当前状态：证书有效 且 剩余天数 > 提醒阈值
        const isNowNormal = result.isValid === true && 
                            (result.daysUntilExpiry === undefined || result.daysUntilExpiry > domain.alert_days);

        // 如果证书已过期或即将到期（剩余天数小于提醒阈值），发送通知
        if (!result.isValid || (result.daysUntilExpiry !== undefined && result.daysUntilExpiry <= domain.alert_days)) {
          await wechatBot.sendAlert(domain, result);
        } 
        // 如果从非正常状态变为正常状态，发送成功通知
        else if (wasAbnormal && isNowNormal) {
          console.log(`[证书状态变化] ${domain.name} 从非正常状态变为正常状态，发送成功通知`);
          await wechatBot.sendSuccessNotification(domain, result);
        }
      } catch (error) {
        results.push({
          domainId: domain.id,
          name: domain.name,
          error: error.message
        });
      }
    }

    res.json({ success: true, data: results, total: domains.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 发送测试通知
router.post('/domains/:id/notify', async (req, res) => {
  try {
    const domain = await db.getDomainById(req.params.id);
    if (!domain) {
      return res.status(404).json({ success: false, error: '域名不存在' });
    }

    const result = await wechatBot.sendTestMessage(domain);
    res.json({ success: result.success, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取通知历史
router.get('/domains/:id/notifications', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const notifications = await db.getNotificationHistory(req.params.id, limit);
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取定时配置
router.get('/schedule/config', async (req, res) => {
  try {
    const configManager = require('../utils/configManager');
    const config = configManager.getConfig();
    const scheduleConfig = config.schedule || {
      enabled: true,
      days: 1,
      hour: 6,
      minute: 30
    };

    console.log('[获取定时配置]', scheduleConfig);
    res.json({ success: true, data: scheduleConfig });
  } catch (error) {
    console.error('[获取定时配置失败]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 保存定时配置
router.post('/schedule/config', async (req, res) => {
  try {
    const { enabled, days, hour, minute } = req.body;

    console.log('[保存定时配置] 接收到的参数:', { enabled, days, hour, minute });

    // 保存到配置文件
    const configManager = require('../utils/configManager');
    const config = configManager.getConfig();

    config.schedule = {
      enabled: enabled !== false,
      days: parseInt(days) || 1,
      hour: parseInt(hour) || 6,
      minute: parseInt(minute) || 30
    };

    console.log('[保存定时配置] 保存的配置:', config.schedule);
    configManager.saveConfig(config);

    // 重新启动定时任务
    const schedule = require('../utils/scheduleManager');
    await schedule.restart();

    res.json({ success: true, message: '定时配置已更新' });
  } catch (error) {
    console.error('[保存定时配置失败]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 发送测试通知
router.post('/test-notification', async (req, res) => {
  try {
    const { webhook } = req.body;

    if (!webhook) {
      return res.status(400).json({ success: false, error: 'Webhook URL 不能为空' });
    }

    // 发送测试消息
    const testMessage = {
      msgtype: 'text',
      text: {
        content: '🔔 证书监控系统测试通知\n\n这是一条测试消息，您的通知配置正常工作！'
      }
    };

    const axios = require('axios');
    const response = await axios.post(webhook, testMessage);

    if (response.data.errcode === 0) {
      res.json({ success: true, message: '测试通知已发送' });
    } else {
      res.json({ success: false, error: response.data.errmsg || '发送失败' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== 通知配置管理 API ==========

// 获取所有配置
router.get('/notification/config', async (req, res) => {
  try {
    const config = configManager.getConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取企业微信配置
router.get('/notification/config/wechat', async (req, res) => {
  try {
    const wechatConfig = configManager.getWechatConfig();
    // 不返回完整的webhook url，只返回是否配置
    const safeConfig = {
      ...wechatConfig,
      webhookUrl: wechatConfig.webhookUrl ? '已配置' : '未配置'
    };
    res.json({ success: true, data: safeConfig });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新企业微信配置
router.put('/notification/config/wechat', async (req, res) => {
  try {
    const { webhookUrl, enabled, mention } = req.body;

    const wechatConfig = {
      webhookUrl: webhookUrl || '',
      enabled: enabled !== undefined ? enabled : true,
      mention: mention || { mobiles: [], userids: [] }
    };

    const updatedConfig = configManager.updateWechatConfig(wechatConfig);
    res.json({ success: true, data: updatedConfig, message: '企业微信配置已更新' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取所有消息模板
router.get('/notification/config/templates', async (req, res) => {
  try {
    const templates = configManager.getAllTemplates();
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取指定类型的消息模板
router.get('/notification/config/templates/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const template = configManager.getTemplate(type);
    if (!template) {
      return res.status(404).json({ success: false, error: '模板类型不存在' });
    }
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新消息模板
router.put('/notification/config/templates/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { title, content, msgtype } = req.body;

    const template = {
      title: title || '',
      content: content || '',
      type: msgtype || 'markdown'
    };

    const updatedTemplate = configManager.updateTemplate(type, template);
    res.json({ success: true, data: updatedTemplate, message: '消息模板已更新' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 测试消息模板
router.post('/notification/config/templates/:type/test', async (req, res) => {
  try {
    const { type } = req.params;
    const config = configManager.getConfig();
    const wechatConfig = configManager.getWechatConfig();

    if (!wechatConfig.webhookUrl || wechatConfig.webhookUrl === 'YOUR_KEY') {
      return res.status(400).json({ success: false, error: '请先配置企业微信 Webhook URL' });
    }

    const template = configManager.getTemplate(type);
    if (!template) {
      return res.status(404).json({ success: false, error: '模板类型不存在' });
    }

    // 替换模板变量
    let content = template.content
      .replace(/{domain_name}/g, 'example.com')
      .replace(/{valid_until}/g, new Date().toISOString())
      .replace(/{days_until_expiry}/g, '30')
      .replace(/{issuer}/g, 'Test Issuer')
      .replace(/{subject}/g, 'CN=example.com')
      .replace(/{send_time}/g, new Date().toISOString())
      .replace(/{error}/g, 'Test Error Message');

    const message = {
      msgtype: template.type,
      [template.type]: {
        content: content
      }
    };

    const axios = require('axios');
    const response = await axios.post(wechatConfig.webhookUrl, message);

    if (response.data.errcode === 0) {
      res.json({ success: true, message: '测试通知已发送' });
    } else {
      res.json({ success: false, error: response.data.errmsg || '发送失败' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 验证配置
router.post('/notification/config/validate', async (req, res) => {
  try {
    const config = req.body;
    const validation = configManager.validateConfig(config);
    res.json({ success: validation.valid, data: validation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 重置配置为默认值
router.post('/notification/config/reset', async (req, res) => {
  try {
    const defaultConfig = configManager.resetConfig();
    res.json({ success: true, data: defaultConfig, message: '配置已重置为默认值' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== 认证管理 API ==========

// 登录
router.post('/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
    }
    
    const result = auth.verifyLogin(username, password);
    if (result.success) {
      res.json({ success: true, message: '登录成功' });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 检查登录状态
router.get('/auth/status', (req, res) => {
  try {
    const isLoggedIn = auth.checkLoginStatus();
    res.json({ success: true, isLoggedIn });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 退出登录
router.post('/auth/logout', (req, res) => {
  try {
    const result = auth.logout();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 修改密码
router.post('/auth/change-password', (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, error: '旧密码和新密码不能为空' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: '新密码长度不能少于6位' });
    }
    
    const result = auth.changePassword(oldPassword, newPassword);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 重置密码（仅用于紧急情况）
router.post('/auth/reset-password', (req, res) => {
  try {
    const result = auth.resetPassword();
    res.json({ ...result, message: '密码已重置为默认密码' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
