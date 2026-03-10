/**
 * 장바구니 라우터
 * - GET    /api/cart          : 장바구니 조회
 * - POST   /api/cart          : 장바구니에 상품 추가
 * - PUT    /api/cart/:itemId  : 장바구니 수량 변경
 * - DELETE /api/cart/:itemId  : 장바구니 항목 삭제
 * - DELETE /api/cart          : 장바구니 전체 삭제
 *
 * 모든 엔드포인트는 인증 필요
 */

const express = require('express');
const { query } = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// 모든 장바구니 라우트에 인증 적용
router.use(authMiddleware);

/**
 * GET /api/cart - 장바구니 조회
 * 상품 정보를 JOIN하여 반환
 */
router.get('/', async (req, res) => {
  try {
    const rows = await query(
      `SELECT ci.id, ci.product_id AS productId, ci.quantity,
              p.name AS productName, p.price AS productPrice,
              p.image_url AS productImageUrl, p.stock
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = ?`,
      [req.user.id]
    );

    res.json({ items: rows });
  } catch (error) {
    console.error('[Cart] 조회 오류:', error);
    res.status(500).json({ error: '장바구니 조회 중 오류가 발생했습니다' });
  }
});

/**
 * POST /api/cart - 장바구니에 상품 추가
 * Body: { productId, quantity }
 */
router.post('/', async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    // 입력 검증
    if (!productId) {
      return res.status(400).json({ error: '상품 ID를 입력해주세요' });
    }

    if (quantity < 1) {
      return res.status(400).json({ error: '수량은 1 이상이어야 합니다' });
    }

    // 상품 존재 여부 확인
    const products = await query('SELECT * FROM products WHERE id = ?', [productId]);
    if (products.length === 0) {
      return res.status(404).json({ error: '상품을 찾을 수 없습니다' });
    }

    // 재고 확인
    if (products[0].stock < quantity) {
      return res.status(400).json({ error: '재고가 부족합니다' });
    }

    // 이미 장바구니에 있는지 확인
    const existing = await query(
      'SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?',
      [req.user.id, productId]
    );

    let item;
    if (existing.length > 0) {
      // 이미 있으면 수량 추가
      const newQuantity = existing[0].quantity + quantity;
      await query(
        'UPDATE cart_items SET quantity = ? WHERE id = ?',
        [newQuantity, existing[0].id]
      );
      item = { id: existing[0].id, product_id: productId, quantity: newQuantity };
    } else {
      // 없으면 새로 추가
      const result = await query(
        'INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)',
        [req.user.id, productId, quantity]
      );
      item = { id: result.insertId, product_id: productId, quantity };
    }

    res.status(201).json({ item });
  } catch (error) {
    console.error('[Cart] 추가 오류:', error);
    res.status(500).json({ error: '장바구니 추가 중 오류가 발생했습니다' });
  }
});

/**
 * PUT /api/cart/:itemId - 장바구니 수량 변경
 * Body: { quantity }
 */
router.put('/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    // 입력 검증
    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: '수량은 1 이상이어야 합니다' });
    }

    // 장바구니 항목 확인 (본인 것인지)
    const items = await query(
      'SELECT * FROM cart_items WHERE id = ? AND user_id = ?',
      [itemId, req.user.id]
    );

    if (items.length === 0) {
      return res.status(404).json({ error: '장바구니 항목을 찾을 수 없습니다' });
    }

    // 재고 확인
    const products = await query('SELECT stock FROM products WHERE id = ?', [items[0].product_id]);
    if (products[0].stock < quantity) {
      return res.status(400).json({ error: '재고가 부족합니다' });
    }

    // 수량 업데이트
    await query('UPDATE cart_items SET quantity = ? WHERE id = ?', [quantity, itemId]);

    const item = { id: parseInt(itemId), product_id: items[0].product_id, quantity };
    res.json({ item });
  } catch (error) {
    console.error('[Cart] 수량 변경 오류:', error);
    res.status(500).json({ error: '수량 변경 중 오류가 발생했습니다' });
  }
});

/**
 * DELETE /api/cart/:itemId - 장바구니 항목 삭제
 */
router.delete('/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    // 본인 항목인지 확인 후 삭제
    const result = await query(
      'DELETE FROM cart_items WHERE id = ? AND user_id = ?',
      [itemId, req.user.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: '장바구니 항목을 찾을 수 없습니다' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Cart] 삭제 오류:', error);
    res.status(500).json({ error: '장바구니 삭제 중 오류가 발생했습니다' });
  }
});

/**
 * DELETE /api/cart - 장바구니 전체 삭제
 */
router.delete('/', async (req, res) => {
  try {
    await query('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('[Cart] 전체 삭제 오류:', error);
    res.status(500).json({ error: '장바구니 비우기 중 오류가 발생했습니다' });
  }
});

module.exports = router;
