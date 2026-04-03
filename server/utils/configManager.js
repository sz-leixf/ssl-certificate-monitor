const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../../data/notification-config.json');

// 默认配置
const defaultConfig = {
  wechat: {
    webhookUrl: process.env.WECHAT_WEBHOOK_URL || '',
    enabled: true,
    mention: {
      mobiles: [],
      userids: []
    }
  },
  schedule: {
    enabled: true,
    days: 1,
    hour: 6,
    minute: 30
  },
  templates: {
    alert: {
      title: '🔔 SSL证书到期提醒',
      content: `### 🔔 SSL证书到期提醒

> **域名**: {domain_name}
> **到期时间**: {valid_until}
> **剩余天数**: {days_until_expiry} 天
> **证书颁发者**: {issuer}
> **证书主题**: {subject}
> **发送时间**: {send_time}

请及时更新证书以免影响服务！`,
      type: 'markdown'
    },
    expired: {
      title: '🚨 SSL证书已过期',
      content: `### 🚨 SSL证书已过期

> **域名**: {domain_name}
> **到期时间**: {valid_until}
> **证书颁发者**: {issuer}
> **证书主题**: {subject}
> **发送时间**: {send_time}

证书已过期，请立即更新！`,
      type: 'markdown'
    },
    warning: {
      title: '⚠️ SSL证书即将到期',
      content: `### ⚠️ SSL证书即将到期

> **域名**: {domain_name}
> **到期时间**: {valid_until}
> **剩余天数**: {days_until_expiry} 天
> **证书颁发者**: {issuer}
> **证书主题**: {subject}
> **发送时间**: {send_time}

证书即将到期，请及时安排更新！`,
      type: 'markdown'
    },
    success: {
      title: '✅ 证书检查成功',
      content: `### ✅ 证书检查成功

> **域名**: {domain_name}
> **发送时间**: {send_time}
> **证书状态**: 正常
> **剩余天数**: {days_until_expiry} 天`,
      type: 'markdown'
    },
    error: {
      title: '❌ 证书检查失败',
      content: `### ❌ 证书检查失败

> **域名**: {domain_name}
> **发送时间**: {send_time}
> **错误信息**: {error}

请检查域名配置和网络连接！`,
      type: 'markdown'
    },
    test: {
      title: '📝 测试通知',
      content: `### 📝 测试通知

> **域名**: {domain_name}
> **消息**: 这是一条测试通知
> **发送时间**: {send_time}

SSL证书监控系统运行正常！`,
      type: 'markdown'
    }
  }
};

// 确保配置目录存在
function ensureConfigDir() {
  const configDir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

// 读取配置
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      const config = JSON.parse(data);
      console.log('[加载配置文件] 文件内容:', config);
      // 合并默认配置，确保所有字段都存在
      const mergedConfig = {
        wechat: { ...defaultConfig.wechat, ...config.wechat },
        schedule: { ...defaultConfig.schedule, ...config.schedule },
        templates: {
          ...defaultConfig.templates,
          ...config.templates
        }
      };
      console.log('[加载配置文件] 合并后的配置:', mergedConfig);
      return mergedConfig;
    }
  } catch (error) {
    console.error('加载配置文件失败:', error.message);
  }
  console.log('[加载配置文件] 使用默认配置');
  return defaultConfig;
}

// 保存配置
function saveConfig(config) {
  try {
    ensureConfigDir();
    console.log('[保存配置文件] 准备保存的配置:', config);
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    console.log('[保存配置文件] 保存成功，路径:', CONFIG_FILE);
    return true;
  } catch (error) {
    console.error('保存配置文件失败:', error.message);
    throw error;
  }
}

// 获取所有配置
function getConfig() {
  return loadConfig();
}

// 获取企业微信配置
function getWechatConfig() {
  const config = loadConfig();
  return config.wechat;
}

// 更新企业微信配置
function updateWechatConfig(wechatConfig) {
  const config = loadConfig();
  config.wechat = {
    ...config.wechat,
    ...wechatConfig
  };
  saveConfig(config);
  return config.wechat;
}

// 获取消息模板
function getTemplate(templateType) {
  const config = loadConfig();
  let template = config.templates[templateType] || config.templates.alert;
  
  // 兼容旧格式：如果模板是字符串，转换为对象格式
  if (typeof template === 'string') {
    template = {
      title: templateType,
      content: template,
      type: 'markdown'
    };
  }
  
  return template;
}

// 获取所有消息模板
function getAllTemplates() {
  const config = loadConfig();
  return config.templates;
}

// 更新消息模板
function updateTemplate(templateType, template) {
  const config = loadConfig();
  config.templates[templateType] = {
    ...config.templates[templateType],
    ...template
  };
  saveConfig(config);
  return config.templates[templateType];
}

// 重置配置为默认值
function resetConfig() {
  saveConfig(defaultConfig);
  return defaultConfig;
}

// 测试配置是否有效
function validateConfig(config) {
  const errors = [];

  if (!config.wechat.webhookUrl) {
    errors.push('企业微信 Webhook URL 不能为空');
  }

  if (config.wechat.webhookUrl && !config.wechat.webhookUrl.includes('qyapi.weixin.qq.com')) {
    errors.push('企业微信 Webhook URL 格式不正确');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  getConfig,
  saveConfig,
  getWechatConfig,
  updateWechatConfig,
  getTemplate,
  getAllTemplates,
  updateTemplate,
  resetConfig,
  validateConfig
};
