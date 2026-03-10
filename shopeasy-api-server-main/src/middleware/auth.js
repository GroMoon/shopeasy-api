/**
 * JWT 인증 미들웨어
 * - Authorization 헤더에서 Bearer 토큰 추출
 * - 토큰 검증 후 req.user에 사용자 정보 설정
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ecommerce-jwt-secret-key-2024';

/**
 * 인증 미들웨어
 * - 인증 필요한 라우트에 적용
 * - 성공 시 req.user = { id, email, name } 설정
 */
function authMiddleware(req, res, next) {
  try {
    // Authorization 헤더 확인
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: '인증 토큰이 필요합니다' });
    }

    // Bearer 토큰 추출
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: '올바른 토큰 형식이 아닙니다 (Bearer <token>)' });
    }

    const token = parts[1];

    // 토큰 검증
    const decoded = jwt.verify(token, JWT_SECRET);

    // req.user에 사용자 정보 설정
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '토큰이 만료되었습니다' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다' });
    }
    return res.status(500).json({ error: '인증 처리 중 오류가 발생했습니다' });
  }
}

module.exports = authMiddleware;
