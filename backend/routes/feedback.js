const express = require('express');
const https   = require('https');
const crypto  = require('crypto');
const sgMail  = require('@sendgrid/mail');

const router = express.Router();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
  const { payload } = req.body;

  if (!payload) {
    return res.status(400).json({ error: 'Missing payload' });
  }

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
            sendNotificationEmail();
          }
        } catch (e) {
          console.error('無法解析回傳 JSON:', e);
        }
      }

      res.status(jspRes.statusCode).json({
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
