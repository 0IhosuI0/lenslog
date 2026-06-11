// src/middlewares/auth.js
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // Authorization: Bearer TOKEN_VALUE 형태 파싱
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ status: "error", message: "인증 토큰이 누락되었습니다." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'lenslog_secret_key_2026');
    req.user = decoded; // 토큰에 담긴 유저 ID 등의 정보를 req 객체에 바인딩
    next();
  } catch (err) {
    return res.status(403).json({ status: "error", message: "유효하지 않거나 만료된 토큰입니다." });
  }
};

module.exports = { verifyToken };