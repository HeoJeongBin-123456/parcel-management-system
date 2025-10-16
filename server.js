require('dotenv').config();

const path = require('path');
const { createExpressApp } = require('./lib/createExpressApp');

const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1';

const app = createExpressApp({ projectRoot: __dirname });

function startServer() {
    const server = app.listen(PORT, HOST, () => {
        console.log(`
        ======================================
        🚀 서버가 시작되었습니다!
        
        📍 로컬: http://${HOST}:${PORT}
        📍 네트워크: http://${HOST}:${PORT}
        
        ✅ parcel-management-system
        ======================================
        `);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`❌ 포트 ${PORT}이 이미 사용 중입니다. 서버를 종료합니다.`);
            console.error('이미 실행 중인 개발 서버가 있다면 종료 후 다시 시도해주세요.');
            process.exit(1);
        }

        console.error('서버 시작 오류:', err);
        process.exit(1);
    });
}

if (require.main === module) {
    startServer();
}

module.exports = app;
