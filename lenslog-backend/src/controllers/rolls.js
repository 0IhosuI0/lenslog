// src/controllers/rolls.js
const prisma = require('../config/db');

// 1. 내 필름 롤 목록 조회 (GET /api/rolls)
const getRolls = async (req, res) => {
  try {
    const rolls = await prisma.roll.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' } // 최신 등록순 정렬
    });
    res.json({ status: "success", data: rolls });
  } catch (error) {
    console.error("필름 롤 조회 에러:", error);
    res.status(500).json({ status: "error", message: "필름 목록을 불러오지 못했습니다." });
  }
};

// 2. 새 필름 롤 추가 (POST /api/rolls)
const addRoll = async (req, res) => {
  try {
    const { name, maxFrames } = req.body;
    
    if (!name || !maxFrames) {
      return res.status(400).json({ status: "error", message: "필름 이름과 최대 컷 수를 모두 입력해주세요." });
    }

    const newRoll = await prisma.roll.create({
      data: {
        name,
        maxFrames: parseInt(maxFrames, 10), // 정수형 변환 저장
        userId: req.user.id
      }
    });
    
    res.status(201).json({ status: "success", message: "새 필름 롤이 등록되었습니다.", data: newRoll });
  } catch (error) {
    console.error("필름 롤 추가 에러:", error);
    res.status(500).json({ status: "error", message: "필름 롤 등록에 실패했습니다." });
  }
};

// 3. 필름 롤 삭제 (DELETE /api/rolls/:id)
const deleteRoll = async (req, res) => {
  try {
    const { id } = req.params;

    // 본인 소유의 필름인지 확인
    const roll = await prisma.roll.findUnique({ where: { id } });
    if (!roll || roll.userId !== req.user.id) {
      return res.status(403).json({ status: "error", message: "삭제 권한이 없거나 존재하지 않는 필름입니다." });
    }

    await prisma.roll.delete({ where: { id } });
    res.json({ status: "success", message: "필름 롤이 삭제되었습니다." });
  } catch (error) {
    console.error("필름 롤 삭제 에러:", error);
    res.status(500).json({ status: "error", message: "필름 롤 삭제에 실패했습니다." });
  }
};

module.exports = {
  getRolls,
  addRoll,
  deleteRoll
};