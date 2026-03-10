/**
 * 파일 스토리지 서비스 추상화
 * - local 모드: 로컬 디스크(uploads/)에 파일 저장
 * - s3 모드: AWS S3 버킷에 파일 업로드
 */

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local';
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

/**
 * 파일 업로드
 * @param {Object} file - multer 파일 객체 (buffer, originalname, mimetype)
 * @returns {Promise<string>} 업로드된 파일의 URL
 */
async function uploadFile(file) {
  if (STORAGE_TYPE === 's3') {
    return uploadToS3(file);
  } else {
    return uploadToLocal(file);
  }
}

/**
 * 로컬 디스크에 파일 저장
 */
function uploadToLocal(file) {
  // uploads 디렉토리가 없으면 생성
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  // 고유한 파일명 생성 (UUID + 원본 확장자)
  const ext = path.extname(file.originalname);
  const fileName = `${uuidv4()}${ext}`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  // 파일 저장
  fs.writeFileSync(filePath, file.buffer);

  // 접근 가능한 URL 반환
  return `/uploads/${fileName}`;
}

/**
 * S3에 파일 업로드
 */
async function uploadToS3(file) {
  const { getS3Client } = require('../config/aws');
  const { PutObjectCommand } = require('@aws-sdk/client-s3');

  const s3 = getS3Client();
  const ext = path.extname(file.originalname);
  const key = `uploads/${uuidv4()}${ext}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await s3.send(command);

  // S3 URL 반환
  const region = process.env.S3_REGION || 'ap-northeast-2';
  return `https://${process.env.S3_BUCKET}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * S3 Pre-signed URL 생성
 * - 클라이언트에서 직접 S3에 업로드할 수 있는 임시 URL 생성
 * @param {string} fileName - 파일명
 * @param {string} fileType - MIME 타입
 * @returns {Promise<{ uploadUrl: string, fileUrl: string }>}
 */
async function getPresignedUrl(fileName, fileType) {
  if (STORAGE_TYPE !== 's3') {
    throw new Error('Pre-signed URL은 S3 모드에서만 사용 가능합니다');
  }

  const { getS3Client } = require('../config/aws');
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

  const s3 = getS3Client();
  const ext = path.extname(fileName);
  const key = `uploads/${uuidv4()}${ext}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: fileType,
  });

  // 15분 유효한 pre-signed URL 생성
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

  const region = process.env.S3_REGION || 'ap-northeast-2';
  const fileUrl = `https://${process.env.S3_BUCKET}.s3.${region}.amazonaws.com/${key}`;

  return { uploadUrl, fileUrl };
}

module.exports = { uploadFile, getPresignedUrl };
