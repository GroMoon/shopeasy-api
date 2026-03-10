/**
 * 리뷰 라우터
 * - GET  /api/products/:id/reviews  : 상품 리뷰 목록 조회
 * - POST /api/products/:id/reviews  : 리뷰 작성 (인증 필요)
 *
 * 주의: 이 라우터는 mergeParams: true로 생성되어
 *       상위 라우터의 :id 파라미터에 접근 가능
 */

const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getReviews, createReview } = require('../services/reviewStore');
const cache = require('../services/cache');

const router = express.Router({ mergeParams: true });

/**
 * GET /api/products/:id/reviews - 상품 리뷰 목록 조회
 */
router.get('/', async (req, res) => {
  try {
    const productId = req.params.id;

    // 캐시 확인
    const cacheKey = `reviews:${productId}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({ reviews: cached });
    }

    const reviews = await getReviews(productId);

    // 결과 캐싱 (60초)
    await cache.set(cacheKey, reviews, 60);

    res.json({ reviews });
  } catch (error) {
    console.error('[Reviews] 목록 조회 오류:', error);
    res.status(500).json({ error: '리뷰 조회 중 오류가 발생했습니다' });
  }
});

/**
 * POST /api/products/:id/reviews - 리뷰 작성 (인증 필요)
 * Body: { rating, content, imageUrls }
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const productId = req.params.id;
    const { rating, content, imageUrls } = req.body;

    // 입력 검증
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: '평점은 1~5 사이의 값이어야 합니다' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: '리뷰 내용을 입력해주세요' });
    }

    // 리뷰 생성
    const review = await createReview({
      productId,
      userId: req.user.id,
      userName: req.user.name,
      rating: parseInt(rating),
      content: content.trim(),
      imageUrls: imageUrls || [],
    });

    // 리뷰 캐시 무효화
    await cache.del(`reviews:${productId}`);

    res.status(201).json({ review });
  } catch (error) {
    console.error('[Reviews] 작성 오류:', error);
    res.status(500).json({ error: '리뷰 작성 중 오류가 발생했습니다' });
  }
});

module.exports = router;
