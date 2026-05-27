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
    if (err.response) console.error(err.response.body);
  }
}

router.post('/', (req, res) => {
  const data = req.body;

  if (!data || Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Missing data' });
  }

  if (!process.env.API_URL) {
    return res.status(502).json({ error: 'Bad Gateway: Feedback service not configured.' });
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

      if (jspRes.statusCode === 200) {
        try {
          parsed = JSON.parse(data);
          if (parsed.status === 'success') {
            isSuccess = true;
            // 程式註解，暫不使用
            //sendNotificationEmail();
          }
        } catch (e) {
          console.error('無法解析回傳 JSON:', e);
        }
      }
      const finalStatusCode = isSuccess ? jspRes.statusCode : 400;
      res.status(finalStatusCode).json({
        success: isSuccess,
        message: isSuccess ? 'Request success' : 'Request Error',
        Data:    parsed || data,
      });
    });
  });

  jspReq.on('error', (err) => {
    console.error('Error forwarding:', err);
    res.status(502).json({ error: 'Bad Gateway: Cannot connect to server.' });
  });

  jspReq.end();
});

module.exports = router;
