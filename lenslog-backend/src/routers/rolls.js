// src/routers/rolls.js
const express = require('express');
const router = express.Router();
const { getRolls, addRoll, deleteRoll } = require('../controllers/rolls');
const { verifyToken } = require('../middlewares/auth'); // 구조 분해 할당으로 함수만 가져오도록 수정

router.get('/', verifyToken, getRolls);
router.post('/', verifyToken, addRoll);
router.delete('/:id', verifyToken, deleteRoll);

module.exports = router;