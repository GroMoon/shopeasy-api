/**
 * 이커머스 API 서버 (쿠팡 스타일)
 * - AWS 교육용 프로젝트
 * - 로컬 모드 (Day 1-2): SQLite + 로컬 파일 + 인메모리 캐시
 * - AWS 모드 (Day 3-5): MySQL(RDS) + S3 + DynamoDB + Redis
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// ========================================
// 미들웨어 설정
// ========================================

// CORS 설정 (모든 출처 허용 - 개발용)
app.use(cors());

// JSON 바디 파싱
app.use(express.json());

// URL-encoded 바디 파싱
app.use(express.urlencoded({ extended: true }));

// 정적 파일 서빙 (업로드된 이미지)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ========================================
// 라우트 설정
// ========================================

// 인증
app.use('/api/auth', require('./routes/auth'));

// 상품
app.use('/api/products', require('./routes/products'));

// 리뷰 (상품 하위 라우트)
app.use('/api/products/:id/reviews', require('./routes/reviews'));

// 장바구니
app.use('/api/cart', require('./routes/cart'));

// 주문
app.use('/api/orders', require('./routes/orders'));

// 파일 업로드
app.use('/api/upload', require('./routes/upload'));

// ========================================
// 헬스 체크 및 설정 확인 엔드포인트
// ========================================

/**
 * GET /api/health - 서버 상태 확인
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      dbType: process.env.DB_TYPE || 'sqlite',
      storageType: process.env.STORAGE_TYPE || 'local',
      reviewStore: process.env.REVIEW_STORE || 'local',
      cacheType: process.env.CACHE_TYPE || 'memory',
      queueType: process.env.QUEUE_TYPE || 'sync',
    },
  });
});

/**
 * GET /api/config - 현재 서비스 설정 확인
 */
app.get('/api/config', (req, res) => {
  res.json({
    storageType: process.env.STORAGE_TYPE || 'local',
    reviewStore: process.env.REVIEW_STORE || 'local',
    dbType: process.env.DB_TYPE || 'sqlite',
  });
});

// ========================================
// 에러 핸들링
// ========================================

// 404 처리
app.use((req, res) => {
  res.status(404).json({ error: '요청한 리소스를 찾을 수 없습니다' });
});

// 전역 에러 핸들러
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  res.status(err.status || 500).json({
    error: err.message || '서버 내부 오류가 발생했습니다',
  });
});

// ========================================
// 서버 시작
// ========================================

async function startServer() {
  try {
    // 데이터베이스 초기화
    await initDatabase();

    // 서버 시작
    app.listen(PORT, () => {
      console.log('========================================');
      console.log(`  이커머스 API 서버 시작`);
      console.log(`  포트: ${PORT}`);
      console.log(`  DB: ${process.env.DB_TYPE || 'sqlite'}`);
      console.log(`  스토리지: ${process.env.STORAGE_TYPE || 'local'}`);
      console.log(`  리뷰 저장소: ${process.env.REVIEW_STORE || 'local'}`);
      console.log(`  캐시: ${process.env.CACHE_TYPE || 'memory'}`);
      console.log(`  큐: ${process.env.QUEUE_TYPE || 'sync'}`);
      console.log('========================================');
    });
  } catch (error) {
    console.error('[Server] 서버 시작 실패:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
