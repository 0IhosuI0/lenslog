// src/controllers/auth.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET 환경변수가 설정되지 않았습니다.");
  process.exit(1); // 서버 구동 차단
}

// 1. 회원가입 (DB에 영구 저장)
const register = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ status: "error", message: "아이디와 비밀번호를 모두 입력해주세요." });
    }

    // Prisma를 이용한 중복 유저 검증
    const userExists = await prisma.user.findUnique({
      where: { username }
    });
    
    if (userExists) {
      return res.status(400).json({ status: "error", message: "이미 존재하는 아이디입니다." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Prisma를 이용한 신규 유저 생성
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword
      }
    });

    res.status(201).json({
      status: "success",
      message: "회원가입이 완료되었습니다.",
      data: { id: newUser.id, username: newUser.username }
    });
  } catch (err) {
    console.error("🔥 상세 에러 추적 로그:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// 2. 로그인 처리
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Prisma 유저 탐색
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return res.status(400).json({ status: "error", message: "아이디 또는 비밀번호가 일치하지 않습니다." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ status: "error", message: "아이디 또는 비밀번호가 일치하지 않습니다." });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      status: "success",
      message: "로그인 성공",
      token: token,
      user: { id: user.id, username: user.username }
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// 3. 내 정보 확인
const getMe = async (req, res) => {
  try {
    // Prisma 유저 매핑
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, username: true, createdAt: true } // 비밀번호 제외 조회
    });
    
    if (!user) {
      return res.status(444).json({ status: "error", message: "존재하지 않는 유저입니다." });
    }

    res.json({ status: "success", user });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

module.exports = { register, login, getMe };