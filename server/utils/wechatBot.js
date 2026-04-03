const axios = require('axios');
const db = require('../db/database');
const configManager = require('./configManager');

// 获取企业微信配置
function getWechatConfig() {
  try {
    return configManager.getWechatConfig();
  } catch (error) {
    console.error('获取企业微信配置失败:', error.message);
    return { webhookUrl: '', enabled: true };
  }
}

async function sendAlert(domain, certificateInfo) {
  try {
    console.log(`[发送通知] 域名: ${domain.name}, 启用状态: ${domain.enabled}, 提醒阈值: ${domain.alert_days}`);
    console.log(`[发送通知] 证书信息:`, JSON.stringify(certificateInfo, null, 2));

    const wechatConfig = getWechatConfig();
    console.log(`[发送通知] 企业微信配置:`, {
      hasWebhookUrl: !!wechatConfig.webhookUrl,
      webhookUrlPreview: wechatConfig.webhookUrl ? wechatConfig.webhookUrl.substring(0, 30) + '...' : '无',
      enabled: wechatConfig.enabled
    });

    if (!wechatConfig.webhookUrl || wechatConfig.webhookUrl === 'YOUR_KEY' || !wechatConfig.enabled) {
      console.warn('企业微信通知未配置或已禁用，跳过发送通知');
      await db.recordNotification(
        domain.id,
        certificateInfo.daysUntilExpiry,
        'skipped',
        '企业微信 Webhook URL 未配置或通知已禁用'
      );
      return;
    }

    // 获取该域名的提醒阈值
    const alertDays = domain.alert_days || 10;
    const daysUntilExpiry = certificateInfo.daysUntilExpiry;

    // 如果证书检查失败（有错误信息），发送检查失败通知
    if (!certificateInfo.isValid && certificateInfo.error) {
      console.log(`[发送通知] 证书检查失败: ${certificateInfo.error}`);
      const template = configManager.getTemplate('error');
      const message = buildMessage(template, domain, certificateInfo);
      await sendMessage(wechatConfig.webhookUrl, message, domain, daysUntilExpiry);
      return;
    }

    // 如果证书本身无效（已过期），发送过期通知
    if (!certificateInfo.isValid) {
      console.log(`[发送通知] 证书已过期`);
      const template = configManager.getTemplate('expired');
      const message = buildMessage(template, domain, certificateInfo);
      await sendMessage(wechatConfig.webhookUrl, message, domain, daysUntilExpiry);
      return;
    }

    console.log(`[发送通知] 判断: daysUntilExpiry=${daysUntilExpiry}, alertDays=${alertDays}`);

    // 证书剩余天数大于提醒阈值，不发送通知
    if (daysUntilExpiry > alertDays) {
      console.log(`[发送通知] 剩余天数 ${daysUntilExpiry} 大于提醒阈值 ${alertDays}，不发送通知`);
      return;
    }

    // 根据剩余天数选择通知类型
    let templateType = 'alert';
    if (daysUntilExpiry < 1) {
      // 已过期（剩余天数 < 1天）
      templateType = 'expired';
      console.log(`[发送通知] 证书已过期（${daysUntilExpiry}天），使用 expired 模板`);
    } else if (daysUntilExpiry <= 7) {
      // 即将到期（剩余天数 <= 7天）
      templateType = 'warning';
      console.log(`[发送通知] 证书即将到期（${daysUntilExpiry}天），使用 warning 模板`);
    } else if (daysUntilExpiry <= 10) {
      // 到期通知（剩余天数 <= 10天）
      templateType = 'alert';
      console.log(`[发送通知] 证书即将到期（${daysUntilExpiry}天），使用 alert 模板`);
    } else {
      // 在提醒阈值范围内（10天 < 剩余天数 <= 提醒阈值）
      templateType = 'alert';
      console.log(`[发送通知] 证书在提醒范围内（${daysUntilExpiry}天），使用 alert 模板`);
    }

    const template = configManager.getTemplate(templateType);
    console.log(`[发送通知] 模板类型: ${templateType}`);

    const message = buildMessage(template, domain, certificateInfo);
    await sendMessage(wechatConfig.webhookUrl, message, domain, daysUntilExpiry);
  } catch (error) {
    console.error(`✗ 企业微信通知发送失败: ${domain.name}`, error.message);
    console.error(`[发送通知] 错误堆栈:`, error.stack);
    await db.recordNotification(
      domain.id,
      certificateInfo.daysUntilExpiry,
      'failed',
      error.message
    );
    return { success: false, error: error.message };
  }
}

// 构建消息
function buildMessage(template, domain, certificateInfo) {
  let content = template.content
    .replace(/{domain_name}/g, domain.name)
    .replace(/{valid_until}/g, certificateInfo.validUntil ? new Date(certificateInfo.validUntil).toLocaleString('zh-CN') : '未知')
    .replace(/{days_until_expiry}/g, certificateInfo.daysUntilExpiry !== undefined ? certificateInfo.daysUntilExpiry : '未知')
    .replace(/{issuer}/g, certificateInfo.issuer || '未知')
    .replace(/{subject}/g, certificateInfo.subject || '未知')
    .replace(/{error}/g, certificateInfo.error || '未知错误')
    .replace(/{send_time}/g, new Date(certificateInfo.lastCheck || Date.now()).toLocaleString('zh-CN'));

  return {
    msgtype: template.type,
    [template.type]: {
      content: content
    }
  };
}

// 发送消息
async function sendMessage(webhookUrl, message, domain, daysUntilExpiry) {
  const response = await axios.post(webhookUrl, message);

  if (response.data.errcode === 0) {
    console.log(`✓ 企业微信通知发送成功: ${domain.name}`);
    await db.recordNotification(
      domain.id,
      daysUntilExpiry,
      'success',
      '通知发送成功'
    );
    return { success: true };
  } else {
    throw new Error(response.data.errmsg);
  }
}

async function sendTestMessage(domain) {
  try {
    const wechatConfig = getWechatConfig();

    if (!wechatConfig.webhookUrl || wechatConfig.webhookUrl === 'YOUR_KEY') {
      return { success: false, error: '企业微信 Webhook URL 未配置' };
    }

    const template = configManager.getTemplate('test');

    // 替换模板变量
    let content = template.content
      .replace(/{domain_name}/g, domain.name)
      .replace(/{send_time}/g, new Date().toLocaleString('zh-CN'));

    const message = {
      msgtype: template.type,
      [template.type]: {
        content: content
      }
    };

    const response = await axios.post(wechatConfig.webhookUrl, message);

    if (response.data.errcode === 0) {
      return { success: true };
    } else {
      throw new Error(response.data.errmsg);
    }
  } catch (error) {
    console.error('发送测试消息失败:', error.message);
    return { success: false, error: error.message };
  }
}

// 发送证书恢复正常通知
async function sendSuccessNotification(domain, certificateInfo) {
  try {
    console.log(`[发送成功通知] 域名: ${domain.name}`);

    const wechatConfig = getWechatConfig();

    if (!wechatConfig.webhookUrl || wechatConfig.webhookUrl === 'YOUR_KEY' || !wechatConfig.enabled) {
      console.warn('企业微信通知未配置或已禁用，跳过发送成功通知');
      return { success: false, error: '企业微信 Webhook URL 未配置或通知已禁用' };
    }

    const template = configManager.getTemplate('success');

    // 替换模板变量
    let content = template.content
      .replace(/{domain_name}/g, domain.name)
      .replace(/{send_time}/g, new Date(certificateInfo.lastCheck || Date.now()).toLocaleString('zh-CN'))
      .replace(/{days_until_expiry}/g, certificateInfo.daysUntilExpiry || '-');

    const message = {
      msgtype: template.type,
      [template.type]: {
        content: content
      }
    };

    const response = await axios.post(wechatConfig.webhookUrl, message);

    if (response.data.errcode === 0) {
      console.log(`✓ 证书恢复正常通知发送成功: ${domain.name}`);
      await db.recordNotification(
        domain.id,
        certificateInfo.daysUntilExpiry,
        'success',
        '证书恢复正常通知发送成功'
      );
      return { success: true };
    } else {
      throw new Error(response.data.errmsg);
    }
  } catch (error) {
    console.error(`✗ 证书恢复正常通知发送失败: ${domain.name}`, error.message);
    await db.recordNotification(
      domain.id,
      certificateInfo.daysUntilExpiry,
      'failed',
      error.message
    );
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendAlert,
  sendTestMessage,
  sendSuccessNotification
};
