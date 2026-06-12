// src/middlewares/auth.js
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ status: "error", message: "인증 토큰이 누락되었습니다." });
  }

  // 1. 하드코딩된 기본값('lenslog_secret_key_2026') 삭제
  // 2. 요청 시점에 환경변수 로드
  const secretKey = process.env.JWT_SECRET;
  
  if (!secretKey) {
    console.error("FATAL ERROR: JWT_SECRET 환경변수가 누락되었습니다.");
    return res.status(500).json({ status: "error", message: "서버 내부 인증 설정 오류입니다." });
  }

  try {
    const decoded = jwt.verify(token, secretKey);
    req.user = decoded; 
    next();
  } catch (err) {
    return res.status(403).json({ status: "error", message: "유효하지 않거나 만료된 토큰입니다." });
  }
};

module.exports = { verifyToken };