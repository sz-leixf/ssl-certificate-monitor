const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 配置文件路径
const AUTH_CONFIG_PATH = path.join(__dirname, '../../data/auth-config.json');

// 默认密码
const DEFAULT_PASSWORD = 'admin123';

// SHA256加密
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// 获取认证配置
function getAuthConfig() {
  try {
    if (fs.existsSync(AUTH_CONFIG_PATH)) {
      const data = fs.readFileSync(AUTH_CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    } else {
      // 创建默认配置
      const defaultConfig = {
        username: 'admin',
        password: hashPassword(DEFAULT_PASSWORD),
        isLoggedIn: false
      };
      saveAuthConfig(defaultConfig);
      return defaultConfig;
    }
  } catch (error) {
    console.error('读取认证配置失败:', error);
    return {
      username: 'admin',
      password: hashPassword(DEFAULT_PASSWORD),
      isLoggedIn: false
    };
  }
}

// 保存认证配置
function saveAuthConfig(config) {
  try {
    const dir = path.dirname(AUTH_CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(AUTH_CONFIG_PATH, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('保存认证配置失败:', error);
    return false;
  }
}

// 登录验证
function verifyLogin(username, password) {
  const config = getAuthConfig();
  if (username === config.username && hashPassword(password) === config.password) {
    config.isLoggedIn = true;
    saveAuthConfig(config);
    return { success: true };
  }
  return { success: false, error: '用户名或密码错误' };
}

// 检查登录状态
function checkLoginStatus() {
  const config = getAuthConfig();
  return config.isLoggedIn;
}

// 退出登录
function logout() {
  const config = getAuthConfig();
  config.isLoggedIn = false;
  saveAuthConfig(config);
  return { success: true };
}

// 修改密码
function changePassword(oldPassword, newPassword) {
  const config = getAuthConfig();
  
  // 验证旧密码
  if (hashPassword(oldPassword) !== config.password) {
    return { success: false, error: '原密码错误' };
  }
  
  // 更新新密码
  config.password = hashPassword(newPassword);
  saveAuthConfig(config);
  
  return { success: true };
}

// 重置密码为默认密码
function resetPassword() {
  const config = getAuthConfig();
  config.password = hashPassword(DEFAULT_PASSWORD);
  config.isLoggedIn = false;
  saveAuthConfig(config);
  return { success: true, password: DEFAULT_PASSWORD };
}

module.exports = {
  verifyLogin,
  checkLoginStatus,
  logout,
  changePassword,
  resetPassword,
  getAuthConfig
};
