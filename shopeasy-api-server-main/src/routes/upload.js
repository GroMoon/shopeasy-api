/**
 * 파일 업로드 라우터
 * - POST /api/upload            : 파일 업로드 (multipart)
 * - POST /api/upload/presigned  : S3 Pre-signed URL 생성
 *
 * 모든 엔드포인트는 인증 필요
 */

const express = require('express');
const multer = require('multer');
const authMiddleware = require('../middleware/auth');
const { uploadFile, getPresignedUrl } = require('../services/storage');

const router = express.Router();

// Multer 설정: 메모리에 임시 저장 (버퍼)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 최대 5MB
  },
  fileFilter: (req, file, cb) => {
    // 이미지 파일만 허용
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다 (JPEG, PNG, GIF, WebP)'));
    }
  },
});

/**
 * POST /api/upload - 파일 업로드
 * - local 모드: uploads/ 디렉토리에 저장
 * - s3 모드: S3 버킷에 업로드
 */
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일을 선택해주세요' });
    }

    // 스토리지 서비스를 통해 파일 업로드
    const fileUrl = await uploadFile(req.file);

    res.json({ fileUrl });
  } catch (error) {
    console.error('[Upload] 업로드 오류:', error);

    // Multer 에러 처리
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: '파일 크기는 5MB 이하여야 합니다' });
      }
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: error.message || '파일 업로드 중 오류가 발생했습니다' });
  }
});

/**
 * POST /api/upload/presigned - S3 Pre-signed URL 생성
 * Body: { fileName, fileType }
 * - S3 모드에서만 동작
 * - 클라이언트가 직접 S3에 업로드할 수 있는 임시 URL 반환
 */
router.post('/presigned', authMiddleware, async (req, res) => {
  try {
    const { fileName, fileType } = req.body;

    if (!fileName || !fileType) {
      return res.status(400).json({ error: '파일명과 파일 타입을 입력해주세요' });
    }

    const result = await getPresignedUrl(fileName, fileType);

    res.json({
      uploadUrl: result.uploadUrl,
      fileUrl: result.fileUrl,
    });
  } catch (error) {
    console.error('[Upload] Pre-signed URL 생성 오류:', error);
    res.status(500).json({ error: error.message || 'Pre-signed URL 생성 중 오류가 발생했습니다' });
  }
});

module.exports = router;
