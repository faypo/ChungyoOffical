require('dotenv').config(); 

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const sgMail = require('@sendgrid/mail'); 

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const MAIL_SEND_FROM = process.env.MAIL_SEND_FROM;
const MAIL_SEND_TO = process.env.MAIL_SEND_TO; 
const API_URL = process.env.API_URL;
const PORT = process.env.PORT || 4000; 
const MAIL_SEND_SUBJECT = process.env.MAIL_SEND_SUBJECT;
const MAIL_SEND_TEXT = process.env.MAIL_SEND_TEXT;

sgMail.setApiKey(SENDGRID_API_KEY);

const prepareTransportPayload = (data) => {
  const rawStream = JSON.stringify(data);
  const processed = CryptoJS.AES.encrypt(rawStream, CryptoJS.enc.Hex.parse(process.env.SECRET_KEY_HEX), {
    iv: CryptoJS.enc.Hex.parse(process.env.SECRET_IV_HEX),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return processed.toString(); 
};

// 需求方取消通知功能 程式留存暫不使用
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

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/feedback') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                // 解析前端傳來的 JSON
                const data = JSON.parse(body);

                if (!data || Object.keys(data).length === 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Missing data' }));
                }

                if (!process.env.API_URL) {
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Bad Gateway: Feedback service not configured.' }));
                }

                const payload = prepareTransportPayload(data);
                const queryString    = new URLSearchParams({ payload }).toString();
                const finalJspUrl    = `${process.env.API_URL}?${queryString}`;

                const requestOptions = {
                    method: 'POST',
                    secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
                };

                const Req = https.request(finalJspUrl, requestOptions, (emp_test) => {
                    let ResponseData = '';

                    emp_test.on('data', chunk => {
                        ResponseData += chunk;
                    });

                    emp_test.on('end', () => {
                        let isApiSuccess = false;
                        let parsedData = null;    

                        const isHttpSuccess = emp_test.statusCode === 200;

                        if (isHttpSuccess) {
                            try {
                                parsedData = JSON.parse(ResponseData); 
                                
                                if (parsedData.status === 'success') {
                                    isApiSuccess = true; 
                                    // 程式註解，暫不使用
                                    // sendNotificationEmail();
                                }

                            } catch (error) {
                                console.error('無法解析回傳的 JSON 資料:', error);
                            }
                        }
                        const finalStatusCode = isApiSuccess ? emp_test.statusCode : 400;

                        res.writeHead(finalStatusCode, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: isApiSuccess, 
                            message: isApiSuccess ? 'Request success' : 'Request Error',
                            Data: parsedData || ResponseData 
                        }));                        
                    });
                });
                
                Req.on('error', (error) => {
                    console.error('Error forwarding:', error);
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Bad Gateway: Cannot connect to server.' }));
                });

                Req.end();

            } catch (error) {
                console.error('Error parsing frontend JSON:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON format' }));
            }
        });

    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});


server.listen(PORT, () => {
    const hostname = require('os').hostname();
    console.log(`Local:   http://localhost:${PORT}`);
    console.log(`Network: http://${hostname}:${PORT}`);
});

