/**
 * 주문 라우터
 * - POST /api/orders  : 장바구니에서 주문 생성
 * - GET  /api/orders  : 주문 내역 조회
 *
 * 모든 엔드포인트는 인증 필요
 */

const express = require('express');
const { query } = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// 모든 주문 라우트에 인증 적용
router.use(authMiddleware);

/**
 * POST /api/orders - 주문 생성
 * 장바구니의 모든 상품을 주문으로 전환
 */
router.post('/', async (req, res) => {
  try {
    // 1. 장바구니 항목 조회 (상품 정보 포함)
    const cartItems = await query(
      `SELECT ci.id, ci.product_id, ci.quantity,
              p.name, p.price, p.stock
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = ?`,
      [req.user.id]
    );

    // 장바구니가 비어있으면 에러
    if (cartItems.length === 0) {
      return res.status(400).json({ error: '장바구니가 비어있습니다' });
    }

    // 2. 재고 확인
    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        return res.status(400).json({
          error: `'${item.name}' 상품의 재고가 부족합니다 (재고: ${item.stock}, 요청: ${item.quantity})`,
        });
      }
    }

    // 3. 총 금액 계산
    const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // 4. 주문 생성
    const orderResult = await query(
      'INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?)',
      [req.user.id, totalAmount, 'pending']
    );

    const orderId = orderResult.insertId;

    // 5. 주문 항목 생성 및 재고 차감
    for (const item of cartItems) {
      // 주문 항목 추가
      await query(
        'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.product_id, item.name, item.quantity, item.price]
      );

      // 재고 차감
      await query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    // 6. 장바구니 비우기
    await query('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);

    // 7. SQS/SNS 메시지 전송 (AWS 모드일 때)
    if (process.env.QUEUE_TYPE === 'sqs') {
      await sendOrderToQueue(orderId, req.user, cartItems, totalAmount);
    }

    // 8. 생성된 주문 정보 반환
    const order = {
      id: orderId,
      userId: req.user.id,
      totalAmount,
      status: 'pending',
      createdAt: new Date().toISOString(),
      items: cartItems.map((item) => ({
        productId: item.product_id,
        productName: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
    };

    res.status(201).json({ order });
  } catch (error) {
    console.error('[Orders] 주문 생성 오류:', error);
    res.status(500).json({ error: '주문 처리 중 오류가 발생했습니다' });
  }
});

/**
 * GET /api/orders - 주문 내역 조회
 */
router.get('/', async (req, res) => {
  try {
    // 주문 목록 조회
    const orders = await query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );

    // 각 주문의 항목 조회
    const ordersWithItems = [];
    for (const order of orders) {
      const items = await query(
        'SELECT * FROM order_items WHERE order_id = ?',
        [order.id]
      );
      ordersWithItems.push({
        id: order.id,
        userId: order.user_id,
        totalAmount: order.total_amount,
        status: order.status,
        createdAt: order.created_at,
        items: items.map((item) => ({
          id: item.id,
          orderId: item.order_id,
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          price: item.price,
        })),
      });
    }

    res.json({ orders: ordersWithItems });
  } catch (error) {
    console.error('[Orders] 목록 조회 오류:', error);
    res.status(500).json({ error: '주문 내역 조회 중 오류가 발생했습니다' });
  }
});

/**
 * SQS 큐에 주문 메시지 전송 및 SNS 알림 발행
 * - AWS 모드(QUEUE_TYPE=sqs)에서만 호출됨
 */
async function sendOrderToQueue(orderId, user, items, totalAmount) {
  try {
    const { getSQSClient, getSNSClient } = require('../config/aws');

    // SQS에 주문 메시지 전송
    if (process.env.SQS_QUEUE_URL) {
      const { SendMessageCommand } = require('@aws-sdk/client-sqs');
      const sqsClient = getSQSClient();

      const message = {
        orderId,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        items: items.map((item) => ({
          productId: item.product_id,
          productName: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        totalAmount,
        createdAt: new Date().toISOString(),
      };

      await sqsClient.send(
        new SendMessageCommand({
          QueueUrl: process.env.SQS_QUEUE_URL,
          MessageBody: JSON.stringify(message),
          MessageAttributes: {
            orderType: {
              DataType: 'String',
              StringValue: 'NEW_ORDER',
            },
          },
        })
      );

      console.log(`[Orders] SQS 메시지 전송 완료 - 주문 #${orderId}`);
    }

    // SNS에 주문 알림 발행
    if (process.env.SNS_TOPIC_ARN) {
      const { PublishCommand } = require('@aws-sdk/client-sns');
      const snsClient = getSNSClient();

      await snsClient.send(
        new PublishCommand({
          TopicArn: process.env.SNS_TOPIC_ARN,
          Subject: `새 주문 알림 - 주문 #${orderId}`,
          Message: JSON.stringify({
            orderId,
            userId: user.id,
            userName: user.name,
            totalAmount,
            itemCount: items.length,
            createdAt: new Date().toISOString(),
          }),
        })
      );

      console.log(`[Orders] SNS 알림 발행 완료 - 주문 #${orderId}`);
    }
  } catch (error) {
    // 큐 전송 실패해도 주문 자체는 성공으로 처리
    console.error('[Orders] SQS/SNS 전송 오류:', error.message);
  }
}

module.exports = router;
