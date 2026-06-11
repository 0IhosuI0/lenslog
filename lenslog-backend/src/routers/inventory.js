// src/routers/inventory.js
const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory');
const { verifyToken } = require('../middlewares/auth');

// 이 라우터 파일 내의 모든 경로는 토큰 인증이 필요합니다.
router.use(verifyToken);

// 바디(Body) 관련 경로
router.get('/bodies', inventoryController.getBodies);
router.post('/bodies', inventoryController.addBody);
router.delete('/bodies/:id', inventoryController.deleteBody);

// 렌즈(Lens) 관련 경로
router.get('/lenses', inventoryController.getLenses);
router.post('/lenses', inventoryController.addLens);
router.delete('/lenses/:id', inventoryController.deleteLens);

module.exports = router;