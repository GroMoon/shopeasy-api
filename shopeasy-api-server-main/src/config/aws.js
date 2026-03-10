/**
 * AWS SDK 클라이언트 초기화 모듈
 * - 필요할 때만 클라이언트를 생성 (Lazy initialization)
 * - S3, DynamoDB, SQS, SNS 클라이언트 제공
 */

// 클라이언트 캐시 (한 번만 생성)
let s3Client = null;
let dynamoDBClient = null;
let dynamoDocClient = null;
let sqsClient = null;
let snsClient = null;

/**
 * S3 클라이언트 반환
 */
function getS3Client() {
  if (!s3Client) {
    const { S3Client } = require('@aws-sdk/client-s3');
    s3Client = new S3Client({
      region: process.env.S3_REGION || 'ap-northeast-2',
    });
    console.log('[AWS] S3 클라이언트 생성 완료');
  }
  return s3Client;
}

/**
 * DynamoDB Document 클라이언트 반환
 * - Document 클라이언트는 JavaScript 객체를 자동으로 DynamoDB 형식으로 변환
 */
function getDynamoDocClient() {
  if (!dynamoDocClient) {
    const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

    dynamoDBClient = new DynamoDBClient({
      region: process.env.DYNAMODB_REGION || 'ap-northeast-2',
    });

    dynamoDocClient = DynamoDBDocumentClient.from(dynamoDBClient, {
      marshallOptions: {
        removeUndefinedValues: true, // undefined 값 자동 제거
      },
    });
    console.log('[AWS] DynamoDB Document 클라이언트 생성 완료');
  }
  return dynamoDocClient;
}

/**
 * SQS 클라이언트 반환
 */
function getSQSClient() {
  if (!sqsClient) {
    const { SQSClient } = require('@aws-sdk/client-sqs');
    sqsClient = new SQSClient({
      region: process.env.S3_REGION || 'ap-northeast-2',
    });
    console.log('[AWS] SQS 클라이언트 생성 완료');
  }
  return sqsClient;
}

/**
 * SNS 클라이언트 반환
 */
function getSNSClient() {
  if (!snsClient) {
    const { SNSClient } = require('@aws-sdk/client-sns');
    snsClient = new SNSClient({
      region: process.env.S3_REGION || 'ap-northeast-2',
    });
    console.log('[AWS] SNS 클라이언트 생성 완료');
  }
  return snsClient;
}

module.exports = {
  getS3Client,
  getDynamoDocClient,
  getSQSClient,
  getSNSClient,
};
