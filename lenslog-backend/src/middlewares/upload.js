// src/middlewares/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 서버 시작 시 업로드 폴더가 없으면 자동 생성
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 파일명 중복 방지를 위해 '현재시간-난수.확장자' 형태로 저장
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'lenslog-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// 파일 필터링: 이미지만 허용 (RAW 파일의 경우 프론트에서 썸네일을 추출해 JPEG/PNG로 보내는 형태 가정)
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

module.exports = upload;