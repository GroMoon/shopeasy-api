/**
 * 인증 라우터
 * - POST /api/auth/signup  : 회원가입
 * - POST /api/auth/login   : 로그인
 * - GET  /api/auth/me       : 현재 사용자 정보 조회
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ecommerce-jwt-secret-key-2024';

/**
 * JWT 토큰 생성
 * @param {Object} user - 사용자 정보
 * @returns {string} JWT 토큰
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * POST /api/auth/signup - 회원가입
 * Body: { email, password, name }
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // 입력 검증
    if (!email || !password || !name) {
      return res.status(400).json({ error: '이메일, 비밀번호, 이름은 필수 항목입니다' });
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '올바른 이메일 형식이 아닙니다' });
    }

    // 비밀번호 길이 검증
    if (password.length < 6) {
      return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다' });
    }

    // 이메일 중복 확인
    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: '이미 등록된 이메일입니다' });
    }

    // 비밀번호 해싱
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 사용자 생성
    const result = await query(
      'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
      [email, passwordHash, name]
    );

    const user = { id: result.insertId, email, name };
    const token = generateToken(user);

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    console.error('[Auth] 회원가입 오류:', error);
    res.status(500).json({ error: '회원가입 처리 중 오류가 발생했습니다' });
  }
});

/**
 * POST /api/auth/login - 로그인
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 입력 검증
    if (!email || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요' });
    }

    // 사용자 조회
    const users = await query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 일치하지 않습니다' });
    }

    const user = users[0];

    // 비밀번호 검증
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 일치하지 않습니다' });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    console.error('[Auth] 로그인 오류:', error);
    res.status(500).json({ error: '로그인 처리 중 오류가 발생했습니다' });
  }
});

/**
 * GET /api/auth/me - 현재 사용자 정보 조회 (인증 필요)
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const users = await query(
      'SELECT id, email, name, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error('[Auth] 사용자 조회 오류:', error);
    res.status(500).json({ error: '사용자 정보 조회 중 오류가 발생했습니다' });
  }
});

module.exports = router;
