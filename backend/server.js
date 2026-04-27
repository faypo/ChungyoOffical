require('dotenv').config(); 

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const sgMail = require('@sendgrid/mail'); 

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const MAIL_SEND_FROM = process.env.MAIL_SEND_FROM;
const MAIL_SEND_TO = process.env.MAIL_SEND_TO; 
const API_URL = process.env.API_URL;
const PORT = process.env.PORT || 4000; 

sgMail.setApiKey(SENDGRID_API_KEY);

const sendNotificationEmail = async () => {
    const msg = {
        to: MAIL_SEND_TO,
        from: MAIL_SEND_FROM,
        subject: MAIL_SEND_SUBJECT,
        text:MAIL_SEND_TEXT,
    };

    try {
        await sgMail.send(msg);
    } catch (error) {
        if (error.response) {
            console.error(error.response.body);
        }
    }
};

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/feedback') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                // 解析前端傳來的 JSON
                const parsedData = JSON.parse(body);
                const transportData = parsedData.payload;

                if (!transportData) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Missing payload' }));
                }

                const queryString = new URLSearchParams({ 'payload': transportData }).toString();
                const finalJspUrl = `${API_URL}?${queryString}`;

                const requestOptions = {
                    method: 'POST',
                    secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
                };

                //測試寄信
                // sendNotificationEmail()
                // res.writeHead(200, { 'Content-Type': 'application/json' });
                // res.end(JSON.stringify({ ok: true }));

                const Req = https.request(finalJspUrl, requestOptions, (emp_test) => {
                    let ResponseData = '';

                    emp_test.on('data', chunk => {
                        ResponseData += chunk;
                    });

                    emp_test.on('end', () => {
                        const isSuccess = emp_test.statusCode === 200;

                        if (isSuccess) {
                            sendNotificationEmail();
                        }

                        res.writeHead(emp_test.statusCode, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: isSuccess,
                            message: 'Request forwarded',
                            Data: ResponseData
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

