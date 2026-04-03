const https = require('https');

async function checkCertificate(hostname) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: hostname,
      port: 443,
      method: 'GET',
      rejectUnauthorized: false, // 允许自签名证书
      agent: false
    };

    const req = https.request(options, (res) => {
      const cert = res.socket.getPeerCertificate();
      
      if (!cert || Object.keys(cert).length === 0) {
        resolve({
          isValid: false,
          error: '无法获取证书信息',
          lastCheck: new Date().toISOString()
        });
        return;
      }

      const validFrom = new Date(cert.valid_from);
      const validUntil = new Date(cert.valid_to);
      const now = new Date();
      const daysUntilExpiry = Math.ceil((validUntil - now) / (1000 * 60 * 60 * 24));
      const isValid = now >= validFrom && now <= validUntil;

      resolve({
        isValid,
        issuer: (cert.issuer && cert.issuer.CN) || (cert.issuer && cert.issuer.O) || 'Unknown',
        subject: (cert.subject && cert.subject.CN) || (cert.subject && cert.subject.O) || hostname,
        validFrom: validFrom.toISOString(),
        validUntil: validUntil.toISOString(),
        daysUntilExpiry,
        lastCheck: new Date().toISOString()
      });
    });

    req.on('error', (error) => {
      resolve({
        isValid: false,
        error: error.message,
        lastCheck: new Date().toISOString()
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        isValid: false,
        error: '连接超时',
        lastCheck: new Date().toISOString()
      });
    });

    req.setTimeout(20000); // 20秒超时
    req.end();
  });
}

module.exports = {
  checkCertificate
};
