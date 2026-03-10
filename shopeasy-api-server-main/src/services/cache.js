/**
 * 캐시 서비스 추상화
 * - memory 모드: 인메모리 Map 사용 (로컬 개발용)
 * - redis 모드: AWS ElastiCache (Redis) 사용
 */

const CACHE_TYPE = process.env.CACHE_TYPE || 'memory';

// ========================================
// 인메모리 캐시 구현
// ========================================

const memoryCache = new Map();

/**
 * 만료된 항목 자동 정리 (1분마다)
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryCache) {
    if (entry.expireAt && entry.expireAt < now) {
      memoryCache.delete(key);
    }
  }
}, 60 * 1000);

// ========================================
// Redis 클라이언트
// ========================================

let redisClient = null;

function getRedisClient() {
  if (!redisClient) {
    const Redis = require('ioredis');

    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT) || 6379;

    const useTls =
      host.includes('cache.amazonaws.com') ||
      process.env.REDIS_TLS === 'true';

    const options = {
      host,
      port,
      retryStrategy(times) {
        if (times > 3) {
          console.error('[Cache] Redis 재시도 초과');
          return null;
        }
        console.log(`[Cache] Redis 재시도 ${times}회`);
        return 2000;
      },
    };

    if (useTls) {
      console.log('[Cache] TLS 활성화');
      options.tls = {};
    }

    redisClient = new Redis(options);

    redisClient.on('connect', () => {
      console.log('[Cache] Redis 연결 성공');
    });

    redisClient.on('ready', async () => {
      console.log('[Cache] Redis ready 상태');

      try {
        const pong = await redisClient.ping();
        console.log('[Cache] Redis PING 결과:', pong);
      } catch (err) {
        console.error('[Cache] Redis PING 실패:', err.message);
      }
    });

    redisClient.on('error', (err) => {
      console.error('[Cache] Redis 연결 오류:', err.message);
    });
  }

  return redisClient;
}

// ========================================
// 서버 시작 시 Redis 강제 연결
// ========================================

if (CACHE_TYPE === 'redis') {
  console.log('[Cache] Redis 모드 활성화');
  getRedisClient(); // 강제 초기화
} else {
  console.log('[Cache] Memory 캐시 모드 활성화');
}

// ========================================
// 통합 인터페이스
// ========================================

async function get(key) {
  if (CACHE_TYPE === 'redis') {
    const client = getRedisClient();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } else {
    const entry = memoryCache.get(key);
    if (!entry) return null;

    if (entry.expireAt && entry.expireAt < Date.now()) {
      memoryCache.delete(key);
      return null;
    }

    return entry.value;
  }
}

async function set(key, value, ttl = 300) {
  if (CACHE_TYPE === 'redis') {
    const client = getRedisClient();
    await client.set(key, JSON.stringify(value), 'EX', ttl);
  } else {
    memoryCache.set(key, {
      value,
      expireAt: Date.now() + ttl * 1000,
    });
  }
}

async function del(key) {
  if (CACHE_TYPE === 'redis') {
    const client = getRedisClient();
    await client.del(key);
  } else {
    memoryCache.delete(key);
  }
}

module.exports = { get, set, del };