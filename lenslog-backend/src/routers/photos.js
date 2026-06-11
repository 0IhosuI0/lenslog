// src/routers/photos.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { getPhotos, addPhoto, deletePhoto, updatePhoto, getGlobalPhotos, uploadAndParseRaw, rotatePhoto } = require('../controllers/photos');
const { verifyToken } = require('../middlewares/auth');

// 업로드 임시 폴더 자동 생성 로직
const uploadDir = path.join(__dirname, '../../uploads/temp');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });

router.post('/upload', verifyToken, upload.single('file'), uploadAndParseRaw);
router.get('/global', verifyToken, getGlobalPhotos);

router.get('/global', verifyToken, getGlobalPhotos);
router.get('/', verifyToken, getPhotos);
router.post('/', verifyToken, addPhoto);
router.delete('/:id', verifyToken, deletePhoto);
router.put('/:id', verifyToken, updatePhoto);
router.put('/:id/rotate', verifyToken, rotatePhoto);

module.exports = router;