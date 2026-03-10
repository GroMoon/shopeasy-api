/**
 * 상품 라우터
 * - GET /api/products       : 상품 목록 조회 (카테고리, 검색 필터)
 * - GET /api/products/:id   : 상품 상세 조회
 */

const express = require('express');
const { query } = require('../config/database');
const cache = require('../services/cache');

const router = express.Router();

/** snake_case → camelCase 변환 */
function toCamel(row) {
  if (!row) return row;
  const obj = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    obj[camelKey] = value;
  }
  return obj;
}

/**
 * GET /api/products - 상품 목록 조회
 * Query: ?category=전자기기&search=노트북
 */
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;

    // 캐시 키 생성
    const cacheKey = `products:${category || 'all'}:${search || ''}`;

    // 캐시 확인
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({ products: cached });
    }

    // SQL 쿼리 동적 생성
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    // 카테고리 필터
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    // 검색어 필터 (상품명, 설명에서 검색)
    if (search) {
      sql += ' AND (name LIKE ? OR description LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    sql += ' ORDER BY created_at DESC';

    const products = (await query(sql, params)).map(toCamel);

    // 결과 캐싱 (60초)
    await cache.set(cacheKey, products, 60);

    res.json({ products });
  } catch (error) {
    console.error('[Products] 목록 조회 오류:', error);
    res.status(500).json({ error: '상품 목록 조회 중 오류가 발생했습니다' });
  }
});

/**
 * GET /api/products/:id - 상품 상세 조회
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 캐시 확인
    const cacheKey = `product:${id}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({ product: cached });
    }

    const products = await query('SELECT * FROM products WHERE id = ?', [id]);

    if (products.length === 0) {
      return res.status(404).json({ error: '상품을 찾을 수 없습니다' });
    }

    const product = toCamel(products[0]);

    // 결과 캐싱 (120초)
    await cache.set(cacheKey, product, 120);

    res.json({ product });
  } catch (error) {
    console.error('[Products] 상세 조회 오류:', error);
    res.status(500).json({ error: '상품 조회 중 오류가 발생했습니다' });
  }
});

module.exports = router;
