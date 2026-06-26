const express = require('express');
const https   = require('https');
const crypto  = require('crypto');
const sgMail  = require('@sendgrid/mail');


// 確保伺服器不會出現效能瓶頸
const httpsAgent = new https.Agent({ 
  keepAlive: true, 
  maxSockets: 100,
  secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
});


const router = express.Router();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// cloudflare turnstile 使用者驗證
async function turnstileMiddleware(req, res, next) {
  const { turnstileToken } = req.body;
  if (!turnstileToken) {
    return res.status(400).json({ success: false, message: 'Verification failed' });
  }

  const SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
  const formData = new URLSearchParams();
  formData.append('secret', SECRET_KEY);
  formData.append('response', turnstileToken);

  try {
    const verifyResponse = await fetch(process.env.TURNSTILE_API_URL, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(5000) 
    });
    const verifyData = await verifyResponse.json();

    if (!verifyData.success) {
      return res.status(400).json({ success: false, message: 'Verification failed' });
    }
    next(); 

  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return res.status(504).json({ success: false, message: 'Verification timeout' });
    }    
    return res.status(500).json({ success: false, message: 'Verification failed' });
  }
}

// 取得hh欄位時間
const getCurrentTime = () =>{
    const now = new Date();
    const currentMinutes = now.getMinutes();
    const remainder = currentMinutes % 10;
    
    if (remainder !== 0) {
      now.setMinutes(currentMinutes + (10 - remainder));
    }

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`
}

// 基本字元跳脫處理
const escapeHTML = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, (tag) => {
    const charsToReplace = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    };
    return charsToReplace[tag] || tag;
  });
};

// AES加密
const prepareTransportPayload = (data) => {
  const rawStream = JSON.stringify(data);

  const key = Buffer.from(process.env.SECRET_KEY_HEX, 'hex');
  const iv = Buffer.from(process.env.SECRET_IV_HEX, 'hex');

  const algorithm = key.length === 16 ? 'aes-128-cbc' : 'aes-256-cbc';
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(rawStream, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  return encrypted; 
};

// 需求方取消通知功能，程式留存暫不使用
async function sendNotificationEmail() {
  try {
    await sgMail.send({
      to:      process.env.MAIL_SEND_TO,
      from:    process.env.MAIL_SEND_FROM,
      subject: process.env.MAIL_SEND_SUBJECT,
      text:    process.env.MAIL_SEND_TEXT,
    });
  } catch (err) {
    if (err.response) console.error('Status:', err.response.status);
  }
}

router.post('/', turnstileMiddleware , (req, res) => {
  const { data } = req.body;

  // 檢查資料是否收到
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Missing data' });
  }

  const { Surname, sex, phone, Opinion } = data;
  if (Surname === undefined || sex === undefined || phone === undefined || Opinion === undefined) {
    return res.status(400).json({ success: false, message: 'Invalid data format' });
  }

  if (typeof Surname !== 'string' || typeof sex !== 'string' || typeof phone !== 'string' || typeof Opinion !== 'string') {
    return res.status(400).json({ success: false, message: 'Invalid data type' });
  }

  if (Opinion.length > 1000) {
    return res.status(400).json({ success: false, message: 'Request Error' });
  }

  const safeData = {
    Surname: escapeHTML(Surname),
    sex: escapeHTML(sex),
    phone: escapeHTML(phone),
    Opinion: escapeHTML(Opinion)
  };

  const validationRules = {
    Surname: /^[\u4e00-\u9fa5]{1,2}$/,
    sex: /^[12]$/,                      
    phone: /^0\d{9}$/,                  
    Opinion: /^[\u4e00-\u9fa5\u3100-\u312F\s\x20-\x7E\u3000-\u303F\uFF00-\uFFEF\u2010-\u203B\u00A1-\u00FF\u20A0-\u20CF\uFE30-\uFE4F\u2200-\u22FF]+$/
  };

  if (
    !validationRules.Surname.test(safeData.Surname) ||
    !validationRules.sex.test(String(safeData.sex)) ||
    !validationRules.phone.test(safeData.phone) ||
    !validationRules.Opinion.test(safeData.Opinion)
  ) {
    return res.status(400).json({ success: false, message: 'Request Error' });
  }

  if (typeof data.payload !== 'string' && typeof data.payload !== 'undefined') {
    return res.status(400).json({ success: false, message: 'Request Error'});
  }

  // 限制傳入資料長度(設定4000字元)
  const rawString = JSON.stringify(safeData);
  if (rawString.length > 4000) {
    return res.status(400).json({ success: false, message: 'Request Error'});
  }

  // 檢查API是否收到
  if (!process.env.API_URL) {
    return res.status(502).json({ success: false, message: 'Request Error'});
  }

  const payload = prepareTransportPayload({...data,hh: getCurrentTime(),});
  const queryString    = new URLSearchParams({ payload }).toString();
  const finalJspUrl    = `${process.env.API_URL}?${queryString}`;
  const requestOptions = {
    method: 'POST',
    timeout: 5000,
    agent:httpsAgent
  };

  //舊版SSL/TLS 故使用Node.js原生機制拋資料
  try {
    const jspReq = https.request(finalJspUrl, requestOptions, (jspRes) => {
      let data = '';

      jspRes.on('error', (err) => {
        if (!res.headersSent) {
          res.status(502).json({ success: false, message: 'Request Error' });
        }
      });

      jspRes.on('data', chunk => { data += chunk; });
      jspRes.on('end', () => {
        if (res.headersSent) return;

        let parsed    = null;
        let isSuccess = false;

        if (data) {
          try {
            parsed = JSON.parse(data);
          } catch (err) {
            console.error('Unable to parse response JSON', err.message); 
          }
        }
        
        if (jspRes.statusCode === 200 && parsed && parsed.status === 'success') {
          isSuccess = true;
          // 程式註解，暫不使用
          // sendNotificationEmail();
        }
        const finalStatusCode = isSuccess ? 200 : (jspRes.statusCode === 200 ? 400 : jspRes.statusCode);
        res.status(finalStatusCode).json({
          success: isSuccess,
          message: isSuccess ? 'Request success' : 'Request Error'
        });
      });
    });

    jspReq.on('timeout', () => {
      jspReq.destroy(new Error('TIMEOUT')); 
    });

    jspReq.on('error', (err) => {
      if (res.headersSent) return;

      if (err.message === 'TIMEOUT') {
        return res.status(504).json({ success: false, message: 'Request Error' });
      }
      console.error('Error forwarding:', err.message);
      res.status(502).json({ success: false, message: 'Request Error' });
    });

    jspReq.end();

  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Request Error' });
    }
  }
});

module.exports = router;
