// src/routers/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const { verifyToken } = require('../middlewares/auth');

// 회원가입 및 로그인 (비인증 엔드포인트)
router.post('/register', authController.register);
router.post('/login', authController.login);

// 내 정보 확인 (인증 토큰 필요)
router.get('/me', verifyToken, authController.getMe);

module.exports = router;