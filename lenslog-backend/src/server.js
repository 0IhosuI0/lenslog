// src/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// 미들웨어 설정
app.use(cors({ // 과제 제출을 위해 모든 출처 허용
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/uploads/originals', express.static(path.join(__dirname, '../uploads/originals')));

// 임시 헬스체크 API
app.get('/api/health', (req, res) => {
  res.json({ status: "success", message: "LensLog API Server is running" });
});

// [라우터 연결부] 추후 각 파일 작성 후 주석 해제
app.use('/api/auth', require('./routers/auth'));
app.use('/api/inventory', require('./routers/inventory'));
app.use('/api/rolls', require('./routers/rolls'));
app.use('/api/photos', require('./routers/photos'));

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: "error", message: "서버 내부 오류가 발생했습니다." });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server running on http://0.0.0.0:${PORT}`);
});