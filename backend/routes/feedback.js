const express = require('express');
const https   = require('https');
const crypto  = require('crypto');
const CryptoJS = require('crypto-js');
const sgMail  = require('@sendgrid/mail');

const router = express.Router();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const prepareTransportPayload = (data) => {
  const rawStream = JSON.stringify(data);
  const processed = CryptoJS.AES.encrypt(rawStream, CryptoJS.enc.Hex.parse(process.env.SECRET_KEY_HEX), {
    iv: CryptoJS.enc.Hex.parse(process.env.SECRET_IV_HEX),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return processed.toString(); 
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

router.post('/', (req, res) => {
  const data = req.body;

  // 檢查資料是否收到
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Missing data' });
  }

  if (typeof data.payload !== 'string' && typeof data.payload !== 'undefined') {
    return res.status(400).json({ success: false, message: 'Request Error'});
  }

  // 限制傳入資料長度(設定3000字元)
  const rawString = JSON.stringify(data);
  if (rawString.length > 3000) {
    return res.status(400).json({ success: false, message: 'Request Error'});
  }

  // 檢查API是否收到
  if (!process.env.API_URL) {
    return res.status(502).json({ success: false, message: 'Request Error'});
  }

  const payload = prepareTransportPayload(data);
  const queryString    = new URLSearchParams({ payload }).toString();
  const finalJspUrl    = `${process.env.API_URL}?${queryString}`;
  const requestOptions = {
    method: 'POST',
    secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
  };

  const jspReq = https.request(finalJspUrl, requestOptions, (jspRes) => {
    let data = '';
    jspRes.on('data', chunk => { data += chunk; });
    jspRes.on('end', () => {
      let parsed    = null;
      let isSuccess = false;

      if (data) {
        try {
          parsed = JSON.parse(data);
        } catch (err) {
          console.error('無法解析回傳 JSON:', err.message); 
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

  jspReq.on('error', (err) => {
    console.error('Error forwarding:', err.message);
    res.status(502).json({ success: false, message: 'Request Error' });
  });

  jspReq.end();
});

module.exports = router;
