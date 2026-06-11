// src/controllers/photos.js
const prisma = require('../config/db');
const fs = require('fs');
const path = require('path');
const { exiftool } = require('exiftool-vendored');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const sharp = require('sharp');


const originalDir = path.join(__dirname, '../../uploads/originals');
if (!fs.existsSync(originalDir)) fs.mkdirSync(originalDir, { recursive: true });

// 1. 내 사진 목록 조회 (GET /api/photos)
const getPhotos = async (req, res) => {
  try {
    const photos = await prisma.photo.findMany({
      where: { userId: req.user.id },
      include: { 
        body: true, 
        lens: true, 
        roll: true 
      }, // 참조된 장비와 필름 정보도 함께 불러옵니다.
      orderBy: { id: 'desc' }
    });
    res.json({ status: "success", data: photos });
  } catch (error) {
    console.error("사진 조회 에러:", error);
    res.status(500).json({ status: "error", message: "사진 목록을 불러오지 못했습니다." });
  }
};

// 2. 새 사진 기록 (POST /api/photos)
const addPhoto = async (req, res) => {
  try {
    const { 
      isDigital, rollId, cutIndex, bodyId, lensId, 
      aperture, shutterSpeed, iso, notes, imageUrl, originalUrl, isPublished 
    } = req.body;

    const newPhoto = await prisma.photo.create({
      data: {
        userId: req.user.id,
        isDigital: isDigital || false,
        rollId: rollId || null,
        cutIndex: cutIndex ? parseInt(cutIndex, 10) : null,
        bodyId, lensId, aperture, shutterSpeed, iso, notes, imageUrl,
        originalUrl: originalUrl || null, // [신규] DB에 원본 URL 기록
        isPublished: isPublished || false
      }
    });
    res.status(201).json({ status: "success", data: newPhoto });
  } catch (error) { res.status(500).json({ status: "error" }); }
};

// 3. 사진 삭제 (DELETE /api/photos/:id)
const deletePhoto = async (req, res) => {
  try {
    const { id } = req.params;

    const photo = await prisma.photo.findUnique({ where: { id } });
    if (!photo || photo.userId !== req.user.id) {
      return res.status(403).json({ status: "error", message: "삭제 권한이 없거나 존재하지 않는 사진입니다." });
    }

    await prisma.photo.delete({ where: { id } });
    res.json({ status: "success", message: "사진이 삭제되었습니다." });
  } catch (error) {
    console.error("사진 삭제 에러:", error);
    res.status(500).json({ status: "error", message: "사진 삭제에 실패했습니다." });
  }
};

// 4. 사진 데이터 수정 (업로드, 토글 등)
const updatePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const { imageUrl, isPublished, iso, notes, aperture, shutterSpeed } = req.body;

    const updatedPhoto = await prisma.photo.update({
      where: { id },
      data: { imageUrl, isPublished, iso, notes, aperture, shutterSpeed }
    });
    res.json({ status: "success", data: updatedPhoto });
  } catch (error) {
    res.status(500).json({ status: "error", message: "수정 실패" });
  }
};

// 전체 퍼블리싱 사진 조회 (GET /api/photos/global)
const getGlobalPhotos = async (req, res) => {
  try {
    const photos = await prisma.photo.findMany({
      where: { isPublished: true },
      include: {
        user: { select: { username: true } },
        body: true,
        lens: true
      },
      orderBy: { id: 'desc' }
    });
    res.json({ status: "success", data: photos });
  } catch (error) {
    res.status(500).json({ status: "error", message: "글로벌 사진 조회 실패" });
  }
};

const uploadAndParseRaw = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ status: "error", message: "파일이 전송되지 않았습니다." });

    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const ext = path.extname(originalName).toLowerCase();
    const isRaw = ['.dng', '.cr2', '.nef', '.arw'].includes(ext);

    let tags = {};
    try { tags = await exiftool.read(filePath); } catch (e) { console.error(e); }

    const fileNameBase = `${Date.now()}_${Math.round(Math.random() * 1000)}`;
    let finalFileName = '';
    let finalPath = '';
    
    // [신규] 원본 보관용 경로 설정
    const originalFileName = `ORIGINAL_${fileNameBase}${ext}`;
    const originalFinalPath = path.join(__dirname, '../../uploads/originals', originalFileName);

    if (isRaw) {
      finalFileName = fileNameBase + '.jpg';
      finalPath = path.join(__dirname, '../../uploads', finalFileName);
      const pythonScriptPath = path.join(__dirname, '../utils/raw_converter.py');
      
      try {
        const { stdout, stderr } = await exec(`python3 "${pythonScriptPath}" "${filePath}" "${finalPath}"`);
        if (!stdout.includes("SUCCESS")) throw new Error(`에러: ${stderr}`);
      } catch (pythonErr) {
        throw new Error(`Python 변환 실패: ${pythonErr.message}`);
      }
      
      // RAW 원본 파일을 삭제하지 않고 originals 폴더로 이동 (보관)
      fs.renameSync(filePath, originalFinalPath);
    } else {
      finalFileName = fileNameBase + (ext || '.jpg');
      finalPath = path.join(__dirname, '../../uploads', finalFileName);
      
      // 일반 사진은 원본 자체가 웹용이므로 같은 파일을 복사하여 보관
      fs.copyFileSync(filePath, originalFinalPath);
      fs.renameSync(filePath, finalPath);
    }

    // 메타데이터 파싱 (기존과 동일)
    let parsedAperture = "수동조리개", parsedShutter = "수동셔터", parsedIso = tags.ISO ? tags.ISO.toString() : null;
    let parsedBody = tags.Model || tags.Make || null, parsedLens = tags.LensModel || tags.Lens || null;
    if (tags.FNumber) parsedAperture = `f/${tags.FNumber}`;
    if (tags.ExposureTime) parsedShutter = typeof tags.ExposureTime === 'number' ? `1/${Math.round(1/tags.ExposureTime)}` : tags.ExposureTime.toString();


    res.json({
      status: "success",
      data: {
        imageUrl: `/uploads/${finalFileName}`,
        originalUrl: `/uploads/originals/${originalFileName}`,
        fileName: originalName,
        exif: { aperture: parsedAperture, shutterSpeed: parsedShutter, body: parsedBody, lens: parsedLens, iso: parsedIso }
      }
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// [신규] 사진 회전 처리 (PUT /api/photos/:id/rotate)
const rotatePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const { direction } = req.body; // 'cw'(시계방향) 또는 'ccw'(반시계방향)

    const photo = await prisma.photo.findUnique({ where: { id } });
    if (!photo || photo.userId !== req.user.id) {
      return res.status(403).json({ status: "error", message: "권한이 없습니다." });
    }

    // 상대 경로(/uploads/...)에서 순수 파일 이름만 추출 (?t= 타임스탬프 제거)
    const fileName = photo.imageUrl.split('/').pop().split('?')[0];
    const filePath = path.join(__dirname, '../../uploads', fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ status: "error", message: "파일을 찾을 수 없습니다." });
    }

    const angle = direction === 'cw' ? 90 : -90;

    // 1. 웹용 이미지 회전 후 덮어쓰기
    const buffer = await sharp(filePath).rotate(angle).toBuffer();
    fs.writeFileSync(filePath, buffer);

    // 2. 원본 이미지도 존재한다면 같이 회전 처리
    if (photo.originalUrl) {
      const origName = photo.originalUrl.split('/').pop().split('?')[0];
      const origPath = path.join(__dirname, '../../uploads/originals', origName);
      if (fs.existsSync(origPath)) {
        const origBuffer = await sharp(origPath).rotate(angle).toBuffer();
        fs.writeFileSync(origPath, origBuffer);
      }
    }

    res.json({ status: "success", message: "회전 완료" });
  } catch (error) {
    console.error("회전 에러:", error);
    res.status(500).json({ status: "error", message: "회전 실패" });
  }
};

module.exports = {
  getPhotos,
  addPhoto,
  deletePhoto,
  updatePhoto,
  getGlobalPhotos,
  uploadAndParseRaw,
  rotatePhoto
};