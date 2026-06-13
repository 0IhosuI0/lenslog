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
  // 1. 클라이언트가 주장하는 타입이 일단 '이미지' 카테고리인지 확인 (모든 image/* 허용)
  const isImageMime = file.mimetype.startsWith('image/');

  // 2. 서버에 저장될 '실제 확장자'가 안전한지 검사하는 화이트리스트
  // 여기에 tiff, heic, bmp 등 사진과 관련된 포맷들을 넉넉하게 등록해 둡니다.
  // (대소문자 무시 플래그 'i'를 사용하여 JPG, Jpg 등도 한 번에 통과시킵니다)
  const safeImageExtensions = /^(jpg|jpeg|png|gif|webp|tiff|tif|bmp|heic|heif|raw|dng|cr2|nef|arw)$/i;
  
  // path.extname() 결과에서 앞의 점(.)을 뺀 순수 확장자만 추출하여 검사
  const ext = path.extname(file.originalname).replace('.', '');
  const isSafeExtension = safeImageExtensions.test(ext);

  // 둘 다 만족해야 통과 (이미지인 척하는 악성 스크립트 .php 등을 원천 차단)
  if (isImageMime && isSafeExtension) {
    cb(null, true);
  } else {
    cb(new Error(`보안 정책에 의해 업로드가 차단되었습니다. 허용되지 않은 확장자(.${ext})입니다.`), false);
  }
};

const upload = multer({ 
  storage: storage, 
  fileFilter: fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB 제한
});

module.exports = upload;