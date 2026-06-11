// src/controllers/inventory.js
const prisma = require('../config/db');

// --- 📷 바디(카메라) 관리 로직 ---

// 1. 내 바디 목록 조회 (GET /api/inventory/bodies)
const getBodies = async (req, res) => {
  try {
    const bodies = await prisma.body.findMany({
      where: { userId: req.user.id },
      orderBy: { name: 'asc' } // 이름순 정렬
    });
    res.json({ status: "success", data: bodies });
  } catch (error) {
    console.error("바디 조회 에러:", error);
    res.status(500).json({ status: "error", message: "바디 목록을 불러오지 못했습니다." });
  }
};

// 2. 새 바디 추가 (POST /api/inventory/bodies)
const addBody = async (req, res) => {
  try {
    const { name, maxShutterSpeed } = req.body;
    if (!name) return res.status(400).json({ status: "error", message: "바디 이름을 입력해주세요." });

    const newBody = await prisma.body.create({
      data: {
        name,
        userId: req.user.id, // JWT 미들웨어에서 넘어온 로그인 유저 ID
        maxShutterSpeed
      }
    });
    res.status(201).json({ status: "success", message: "새 바디가 등록되었습니다.", data: newBody });
  } catch (error) {
    console.error("바디 추가 에러:", error);
    res.status(500).json({ status: "error", message: "바디 등록에 실패했습니다." });
  }
};

// 3. 바디 삭제 (DELETE /api/inventory/bodies/:id)
const deleteBody = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 내 바디가 맞는지 확인 후 삭제 (보안)
    const body = await prisma.body.findUnique({ where: { id } });
    if (!body || body.userId !== req.user.id) {
      return res.status(403).json({ status: "error", message: "삭제 권한이 없거나 존재하지 않는 장비입니다." });
    }

    await prisma.body.delete({ where: { id } });
    res.json({ status: "success", message: "바디가 삭제되었습니다." });
  } catch (error) {
    console.error("바디 삭제 에러:", error);
    res.status(500).json({ status: "error", message: "바디 삭제에 실패했습니다." });
  }
};


// --- 🔍 렌즈 관리 로직 ---

// 4. 내 렌즈 목록 조회 (GET /api/inventory/lenses)
const getLenses = async (req, res) => {
  try {
    const lenses = await prisma.lens.findMany({
      where: { userId: req.user.id },
      orderBy: { name: 'asc' }
    });
    res.json({ status: "success", data: lenses });
  } catch (error) {
    console.error("렌즈 조회 에러:", error);
    res.status(500).json({ status: "error", message: "렌즈 목록을 불러오지 못했습니다." });
  }
};

// 5. 새 렌즈 추가 (POST /api/inventory/lenses)
const addLens = async (req, res) => {
  try {
    const { name, minAperture, maxAperture} = req.body;
    if (!name) return res.status(400).json({ status: "error", message: "렌즈 이름을 입력해주세요." });

    const newLens = await prisma.lens.create({
      data: {
        name,
        userId: req.user.id,
        maxAperture,
        minAperture
      }
    });
    res.status(201).json({ status: "success", message: "새 렌즈가 등록되었습니다.", data: newLens });
  } catch (error) {
    console.error("렌즈 추가 에러:", error);
    res.status(500).json({ status: "error", message: "렌즈 등록에 실패했습니다." });
  }
};

// 6. 렌즈 삭제 (DELETE /api/inventory/lenses/:id)
const deleteLens = async (req, res) => {
  try {
    const { id } = req.params;
    
    const lens = await prisma.lens.findUnique({ where: { id } });
    if (!lens || lens.userId !== req.user.id) {
      return res.status(403).json({ status: "error", message: "삭제 권한이 없거나 존재하지 않는 장비입니다." });
    }

    await prisma.lens.delete({ where: { id } });
    res.json({ status: "success", message: "렌즈가 삭제되었습니다." });
  } catch (error) {
    console.error("렌즈 삭제 에러:", error);
    res.status(500).json({ status: "error", message: "렌즈 삭제에 실패했습니다." });
  }
};

module.exports = {
  getBodies,
  addBody,
  deleteBody,
  getLenses,
  addLens,
  deleteLens
};