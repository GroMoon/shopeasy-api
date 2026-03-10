/**
 * 리뷰 저장소 서비스 추상화
 * - local 모드: SQLite/MySQL의 reviews 테이블 사용
 * - dynamodb 모드: AWS DynamoDB 사용
 */

const { v4: uuidv4 } = require('uuid');

const REVIEW_STORE = process.env.REVIEW_STORE || 'local';

/**
 * 상품의 리뷰 목록 조회
 * @param {number|string} productId - 상품 ID
 * @returns {Promise<Array>} 리뷰 배열
 */
async function getReviews(productId) {
  if (REVIEW_STORE === 'dynamodb') {
    return getReviewsFromDynamoDB(productId);
  } else {
    return getReviewsFromDB(productId);
  }
}

/**
 * 리뷰 생성
 * @param {Object} review - 리뷰 데이터
 * @param {number|string} review.productId - 상품 ID
 * @param {number} review.userId - 사용자 ID
 * @param {string} review.userName - 사용자 이름
 * @param {number} review.rating - 평점 (1-5)
 * @param {string} review.content - 리뷰 내용
 * @param {Array<string>} review.imageUrls - 이미지 URL 배열
 * @returns {Promise<Object>} 생성된 리뷰
 */
async function createReview(review) {
  if (REVIEW_STORE === 'dynamodb') {
    return createReviewInDynamoDB(review);
  } else {
    return createReviewInDB(review);
  }
}

// ========================================
// 로컬 DB (SQLite/MySQL) 구현
// ========================================

/**
 * DB에서 리뷰 조회
 */
async function getReviewsFromDB(productId) {
  const { query } = require('../config/database');

  const reviews = await query(
    'SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC',
    [productId]
  );

  // snake_case → camelCase 변환 및 image_urls JSON 파싱
  return reviews.map((review) => ({
    id: review.id,
    productId: review.product_id,
    userId: review.user_id,
    userName: review.user_name,
    rating: review.rating,
    content: review.content,
    imageUrls: review.image_urls ? JSON.parse(review.image_urls) : [],
    createdAt: review.created_at,
  }));
}

/**
 * DB에 리뷰 생성
 */
async function createReviewInDB(review) {
  const { query } = require('../config/database');

  const imageUrlsJson = JSON.stringify(review.imageUrls || []);

  const result = await query(
    `INSERT INTO reviews (product_id, user_id, user_name, rating, content, image_urls)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [review.productId, review.userId, review.userName, review.rating, review.content, imageUrlsJson]
  );

  // 생성된 리뷰 반환 (camelCase)
  return {
    id: result.insertId,
    productId: review.productId,
    userId: review.userId,
    userName: review.userName,
    rating: review.rating,
    content: review.content,
    imageUrls: review.imageUrls || [],
    createdAt: new Date().toISOString(),
  };
}

// ========================================
// DynamoDB 구현
// ========================================

/**
 * DynamoDB에서 리뷰 조회
 * - Partition Key: productId
 * - Sort Key: createdAt#userId (최신순 정렬)
 */
async function getReviewsFromDynamoDB(productId) {
  const { getDynamoDocClient } = require('../config/aws');
  const { QueryCommand } = require('@aws-sdk/lib-dynamodb');

  const client = getDynamoDocClient();
  const tableName = process.env.DYNAMODB_TABLE || 'Reviews';

  const command = new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'productId = :pid',
    ExpressionAttributeValues: {
      ':pid': String(productId),
    },
    ScanIndexForward: false, // 최신순 정렬 (내림차순)
  });

  const response = await client.send(command);

  // DynamoDB 결과를 통일된 형식으로 변환 (camelCase)
  return (response.Items || []).map((item) => ({
    id: item.reviewId,
    productId: parseInt(item.productId),
    userId: item.userId,
    userName: item.userName,
    rating: item.rating,
    content: item.content,
    imageUrls: item.imageUrls || [],
    createdAt: item.createdAt,
  }));
}

/**
 * DynamoDB에 리뷰 생성
 */
async function createReviewInDynamoDB(review) {
  const { getDynamoDocClient } = require('../config/aws');
  const { PutCommand } = require('@aws-sdk/lib-dynamodb');

  const client = getDynamoDocClient();
  const tableName = process.env.DYNAMODB_TABLE || 'Reviews';

  const now = new Date().toISOString();
  const reviewId = uuidv4();

  // Sort Key: createdAt#userId 형식
  const sortKey = `${now}#${review.userId}`;

  const item = {
    productId: String(review.productId),
    'createdAt#userId': sortKey,
    reviewId: reviewId,
    userId: review.userId,
    userName: review.userName,
    rating: review.rating,
    content: review.content,
    imageUrls: review.imageUrls || [],
    createdAt: now,
  };

  const command = new PutCommand({
    TableName: tableName,
    Item: item,
  });

  await client.send(command);

  return {
    id: reviewId,
    productId: parseInt(review.productId),
    userId: review.userId,
    userName: review.userName,
    rating: review.rating,
    content: review.content,
    imageUrls: review.imageUrls || [],
    createdAt: now,
  };
}

module.exports = { getReviews, createReview };
