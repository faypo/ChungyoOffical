const http = require('http');
const https = require('https');
const crypto = require('crypto');

//  後端 API 的網址
const API_URL = 'https://emp-test.chungyo.com.tw/schedule/COAPI.jsp';
const PORT = 3000;

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/feedback') {
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

                // 將資料組裝成 JSP 要求的 Query String
                const queryString = new URLSearchParams({ 'payload': transportData }).toString();
                const finalJspUrl = `${API_URL}?${queryString}`;

                const requestOptions = {
                    method: 'POST',
                    secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
                };

                //headers:{'Content-Type': 'application/json'},body:{payload:JSON.stringify(transportData)}
                const Req = https.request(finalJspUrl, 
                    requestOptions, (emp_test) => {
                    let ResponseData = '';

                    emp_test.on('data', chunk => {
                        ResponseData += chunk;
                    });

                    emp_test.on('end', () => {
                        // 這裡可以根據  的 statusCode 決定回傳給前端的狀態碼
                        res.writeHead(emp_test.statusCode, { 'Content-Type': 'application/json' });
                        // 假設  回傳的是純文字，我們把它包裝成 JSON 格式回傳，方便 React 處理
                        res.end(JSON.stringify({
                            success: emp_test.statusCode === 200,
                            message: 'Request forwarded to ',
                            Data: ResponseData
                        }));
                    });
                });

                Req.on('error', (error) => {
                    console.error('Error forwarding to :', error);
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Bad Gateway: Cannot connect to  server.' }));
                });

                // 執行發送
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
    const hostname = 'localhost'; // 或使用 os.hostname()
    console.log(`Local:   http://localhost:${PORT}`);
    console.log(`Network: http://${require('os').hostname()}:${PORT}`);
});


