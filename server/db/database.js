const Datastore = require('nedb');
const path = require('path');

const DB_DIR = path.join(__dirname, '../../data');

let domainsDB;
let checksDB;
let notificationsDB;

function getDatabases() {
  if (!domainsDB) {
    domainsDB = new Datastore({ 
      filename: path.join(DB_DIR, 'domains.db'),
      autoload: true 
    });
    domainsDB.ensureIndex({ fieldName: 'name', unique: true });
  }
  
  if (!checksDB) {
    checksDB = new Datastore({ 
      filename: path.join(DB_DIR, 'certificate_checks.db'),
      autoload: true 
    });
    checksDB.ensureIndex({ fieldName: 'domain_id' });
  }
  
  if (!notificationsDB) {
    notificationsDB = new Datastore({ 
      filename: path.join(DB_DIR, 'notifications.db'),
      autoload: true 
    });
    notificationsDB.ensureIndex({ fieldName: 'domain_id' });
  }
  
  return { domainsDB, checksDB, notificationsDB };
}

function initialize() {
  return new Promise((resolve, reject) => {
    getDatabases();
    console.log('数据库初始化成功');
    resolve();
  });
}

function getAllDomains() {
  return new Promise((resolve, reject) => {
    const { domainsDB, checksDB } = getDatabases();
    
    domainsDB.find({}, (err, domains) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (domains.length === 0) {
        resolve([]);
        return;
      }
      
      const domainIds = domains.map(d => d._id);
      
      checksDB.find({ domain_id: { $in: domainIds } })
        .sort({ last_check: -1 })
        .exec((err, checks) => {
          if (err) {
            reject(err);
            return;
          }
          
          const latestChecks = {};
          checks.forEach(check => {
            if (!latestChecks[check.domain_id] || 
                new Date(check.last_check) > new Date(latestChecks[check.domain_id].last_check)) {
              latestChecks[check.domain_id] = check;
            }
          });
          
          const result = domains.map(domain => {
            const latestCheck = latestChecks[domain._id];
            return {
              id: domain._id,
              name: domain.name,
              alert_days: domain.alert_days,
              enabled: domain.enabled,
              created_at: domain.created_at,
              updated_at: domain.updated_at,
              is_valid: latestCheck ? latestCheck.is_valid : null,
              valid_from: latestCheck ? latestCheck.valid_from : null,
              valid_until: latestCheck ? latestCheck.valid_until : null,
              days_until_expiry: latestCheck ? latestCheck.days_until_expiry : null,
              error: latestCheck ? latestCheck.error : null,
              issuer: latestCheck ? latestCheck.issuer : null,
              subject: latestCheck ? latestCheck.subject : null,
              last_check: latestCheck ? latestCheck.last_check : null
            };
          });
          
          // 按创建时间倒序排列
          result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          
          resolve(result);
        });
    });
  });
}

function getDomainById(id) {
  return new Promise((resolve, reject) => {
    const { domainsDB, checksDB } = getDatabases();
    
    domainsDB.findOne({ _id: id }, (err, domain) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!domain) {
        resolve(null);
        return;
      }
      
      checksDB.findOne({ domain_id: id })
        .sort({ last_check: -1 })
        .exec((err, check) => {
          if (err) {
            reject(err);
            return;
          }
          
          resolve({
            id: domain._id,
            name: domain.name,
            alert_days: domain.alert_days,
            enabled: domain.enabled,
            created_at: domain.created_at,
            updated_at: domain.updated_at,
            is_valid: check ? check.is_valid : null,
            valid_from: check ? check.valid_from : null,
            valid_until: check ? check.valid_until : null,
            days_until_expiry: check ? check.days_until_expiry : null,
            error: check ? check.error : null,
            issuer: check ? check.issuer : null,
            subject: check ? check.subject : null,
            last_check: check ? check.last_check : null
          });
        });
    });
  });
}

function createDomain(domain) {
  return new Promise((resolve, reject) => {
    const { domainsDB } = getDatabases();
    
    const newDomain = {
      name: domain.name,
      alert_days: domain.alert_days,
      enabled: domain.enabled !== false,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    domainsDB.insert(newDomain, (err, newDoc) => {
      if (err) {
        reject(err);
      } else {
        resolve({ id: newDoc._id, ...domain });
      }
    });
  });
}

function updateDomain(id, domain) {
  return new Promise((resolve, reject) => {
    const { domainsDB } = getDatabases();
    
    const update = {
      name: domain.name,
      alert_days: domain.alert_days,
      enabled: domain.enabled !== false,
      updated_at: new Date()
    };
    
    domainsDB.update({ _id: id }, { $set: update }, {}, (err, numReplaced) => {
      if (err) {
        reject(err);
      } else if (numReplaced === 0) {
        reject(new Error('域名不存在'));
      } else {
        resolve({ id, ...domain });
      }
    });
  });
}

function deleteDomain(id) {
  return new Promise((resolve, reject) => {
    const { domainsDB, checksDB, notificationsDB } = getDatabases();
    
    // 先删除相关的检查记录
    checksDB.remove({ domain_id: id }, { multi: true }, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      // 删除相关的通知记录
      notificationsDB.remove({ domain_id: id }, { multi: true }, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // 删除域名
        domainsDB.remove({ _id: id }, {}, (err, numRemoved) => {
          if (err) {
            reject(err);
          } else if (numRemoved === 0) {
            reject(new Error('域名不存在'));
          } else {
            resolve({ deletedId: id });
          }
        });
      });
    });
  });
}

function updateDomainCheck(domainId, checkResult) {
  return new Promise((resolve, reject) => {
    const { checksDB } = getDatabases();
    
    const check = {
      domain_id: domainId,
      is_valid: checkResult.isValid || false,
      issuer: checkResult.issuer || null,
      subject: checkResult.subject || null,
      valid_from: checkResult.validFrom || null,
      valid_until: checkResult.validUntil || null,
      days_until_expiry: checkResult.daysUntilExpiry || null,
      error: checkResult.error || null,
      last_check: checkResult.lastCheck || new Date()
    };
    
    checksDB.insert(check, (err, newDoc) => {
      if (err) {
        reject(err);
      } else {
        resolve({ id: newDoc._id });
      }
    });
  });
}

function recordNotification(domainId, daysUntilExpiry, status, message) {
  return new Promise((resolve, reject) => {
    const { notificationsDB } = getDatabases();
    
    const notification = {
      domain_id: domainId,
      days_until_expiry: daysUntilExpiry,
      status: status,
      message: message,
      sent_at: new Date()
    };
    
    notificationsDB.insert(notification, (err, newDoc) => {
      if (err) {
        reject(err);
      } else {
        resolve({ id: newDoc._id });
      }
    });
  });
}

function getNotificationHistory(domainId, limit = 10) {
  return new Promise((resolve, reject) => {
    const { notificationsDB } = getDatabases();
    
    notificationsDB.find({ domain_id: domainId })
      .sort({ sent_at: -1 })
      .limit(limit)
      .exec((err, docs) => {
        if (err) {
          reject(err);
        } else {
          resolve(docs.map(doc => ({
            id: doc._id,
            domain_id: doc.domain_id,
            days_until_expiry: doc.days_until_expiry,
            status: doc.status,
            message: doc.message,
            sent_at: doc.sent_at
          })));
        }
      });
  });
}

function close() {
  return new Promise((resolve) => {
    // NeDB 不需要显式关闭，直接 resolve
    domainsDB = null;
    checksDB = null;
    notificationsDB = null;
    resolve();
  });
}

module.exports = {
  initialize,
  getAllDomains,
  getDomainById,
  createDomain,
  updateDomain,
  deleteDomain,
  updateDomainCheck,
  recordNotification,
  getNotificationHistory,
  close
};
