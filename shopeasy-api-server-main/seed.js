/**
 * 시드 데이터 스크립트
 * - 테스트 사용자 1명 생성
 * - 한국 이커머스 상품 20개 생성
 *
 * 실행: node seed.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const bcrypt = require('bcryptjs');
const { initDatabase, query } = require('./src/config/database');

// ========================================
// 테스트 사용자 데이터
// ========================================

const testUser = {
  email: 'test@test.com',
  password: 'password123',
  name: '테스트유저',
};

// ========================================
// 상품 데이터 (20개 - 한국 이커머스 스타일)
// ========================================

const products = [
  // 전자기기 (4개)
  {
    name: '삼성 갤럭시 S24 울트라',
    description: '최신 AI 기능을 탑재한 프리미엄 스마트폰. 2억 화소 카메라와 티타늄 프레임으로 완벽한 내구성을 자랑합니다.',
    price: 1698000,
    image_url: '/images/products/product-1.jpg',
    category: '전자기기',
    stock: 50,
  },
  {
    name: 'LG 그램 17인치 노트북',
    description: '초경량 17인치 노트북. 무게 1.35kg, 인텔 13세대 프로세서, 16GB RAM, 512GB SSD 탑재.',
    price: 1890000,
    image_url: '/images/products/product-2.jpg',
    category: '전자기기',
    stock: 30,
  },
  {
    name: '애플 에어팟 프로 2세대',
    description: '액티브 노이즈 캔슬링, 적응형 오디오, USB-C 충전 케이스 포함. 최대 30시간 배터리.',
    price: 359000,
    image_url: '/images/products/product-3.jpg',
    category: '전자기기',
    stock: 100,
  },
  {
    name: 'LG 스탠바이미 27인치',
    description: '이동식 터치스크린 모니터. 내장 배터리로 어디서든 자유롭게 사용. 넷플릭스, 유튜브 내장.',
    price: 1090000,
    image_url: '/images/products/product-4.jpg',
    category: '전자기기',
    stock: 20,
  },

  // 패션 (4개)
  {
    name: '나이키 에어맥스 97 - 화이트',
    description: '클래식한 디자인의 나이키 에어맥스 97. 에어 유닛으로 최상의 쿠셔닝 제공. 남녀공용.',
    price: 219000,
    image_url: '/images/products/product-5.jpg',
    category: '패션',
    stock: 80,
  },
  {
    name: '유니클로 히트텍 울트라 웜 세트',
    description: '겨울 필수템! 극세사 히트텍 상하의 세트. 체온을 유지하는 특수 섬유 기술.',
    price: 49900,
    image_url: '/images/products/product-6.jpg',
    category: '패션',
    stock: 200,
  },
  {
    name: '캉골 버킷햇 클래식',
    description: '영국 정통 캉골 버킷햇. 사계절 활용 가능한 클래식 디자인. 면 100%.',
    price: 69000,
    image_url: '/images/products/product-7.jpg',
    category: '패션',
    stock: 150,
  },
  {
    name: '노스페이스 눕시 패딩 자켓',
    description: '700 필파워 구스다운 충전재. 방수, 방풍 기능. 가벼우면서도 뛰어난 보온성.',
    price: 399000,
    image_url: '/images/products/product-8.jpg',
    category: '패션',
    stock: 60,
  },

  // 식품 (4개)
  {
    name: '곰곰 유기농 현미 10kg',
    description: '국내산 100% 유기농 현미. GAP 인증. 건강한 식탁을 위한 프리미엄 쌀.',
    price: 42900,
    image_url: '/images/products/product-9.jpg',
    category: '식품',
    stock: 300,
  },
  {
    name: '정관장 홍삼정 에브리타임 30포',
    description: '6년근 홍삼 농축액 스틱. 하루 한 포로 간편하게 건강 관리. 휴대 편리.',
    price: 52000,
    image_url: '/images/products/product-10.jpg',
    category: '식품',
    stock: 500,
  },
  {
    name: '비비고 왕교자 만두 1.4kg',
    description: '두툼한 피에 꽉 찬 속. 국내산 돼지고기와 채소로 만든 프리미엄 만두.',
    price: 12900,
    image_url: '/images/products/product-11.jpg',
    category: '식품',
    stock: 1000,
  },
  {
    name: '스타벅스 캡슐 커피 믹스 60개입',
    description: '네스프레소 호환 캡슐. 하우스 블렌드, 콜롬비아, 에스프레소 로스트 3종 구성.',
    price: 34900,
    image_url: '/images/products/product-12.jpg',
    category: '식품',
    stock: 400,
  },

  // 생활용품 (4개)
  {
    name: '다이슨 V15 무선 청소기',
    description: '레이저 먼지 감지 기술. 최대 60분 사용. LCD 디스플레이로 실시간 먼지 크기 분석.',
    price: 1190000,
    image_url: '/images/products/product-13.jpg',
    category: '생활용품',
    stock: 25,
  },
  {
    name: '쿠쿠 IH 전기압력밥솥 10인용',
    description: 'IH 가열 방식으로 균일한 열 전달. 음성안내, 자동세척 기능. 에너지 효율 1등급.',
    price: 289000,
    image_url: '/images/products/product-14.jpg',
    category: '생활용품',
    stock: 40,
  },
  {
    name: '코웨이 아이콘 정수기 렌탈',
    description: '냉온정수 일체형. 직수형 필터 시스템. 월 렌탈료 포함 가격 (36개월 약정).',
    price: 39900,
    image_url: '/images/products/product-15.jpg',
    category: '생활용품',
    stock: 100,
  },
  {
    name: '일룸 데스커 모션 데스크',
    description: '전동 높이 조절 스탠딩 데스크. 메모리 기능 3단계. 1400mm 상판.',
    price: 699000,
    image_url: '/images/products/product-16.jpg',
    category: '생활용품',
    stock: 15,
  },

  // 뷰티 (4개)
  {
    name: '설화수 자음생 크림 60ml',
    description: '한방 안티에이징 크림. 인삼 추출물로 피부 탄력 강화. 깊은 보습과 영양 공급.',
    price: 170000,
    image_url: '/images/products/product-17.jpg',
    category: '뷰티',
    stock: 70,
  },
  {
    name: '이니스프리 그린티 세럼 80ml',
    description: '제주 유기농 녹차에서 추출한 세럼. 수분 진정 효과. 순한 성분으로 민감 피부에도 적합.',
    price: 25000,
    image_url: '/images/products/product-18.jpg',
    category: '뷰티',
    stock: 300,
  },
  {
    name: '라네즈 립 슬리핑 마스크 20g',
    description: '밤사이 입술을 촉촉하게 케어하는 슬리핑 마스크. 베리 향. 각질 제거 및 보습.',
    price: 18000,
    image_url: '/images/products/product-19.jpg',
    category: '뷰티',
    stock: 500,
  },
  {
    name: '에스티로더 더블웨어 파운데이션',
    description: '24시간 지속력의 풀커버 파운데이션. 세미매트 마무리. SPF10. 다양한 색상 선택 가능.',
    price: 64000,
    image_url: '/images/products/product-20.jpg',
    category: '뷰티',
    stock: 120,
  },
];

// ========================================
// 시드 실행
// ========================================

async function seed() {
  try {
    console.log('========================================');
    console.log('  시드 데이터 생성 시작');
    console.log('========================================');

    // 데이터베이스 초기화
    await initDatabase();

    // 1. 테스트 사용자 생성
    console.log('\n[1/2] 테스트 사용자 생성 중...');

    // 기존 테스트 사용자 확인
    const existingUsers = await query('SELECT id FROM users WHERE email = ?', [testUser.email]);

    if (existingUsers.length === 0) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(testUser.password, salt);

      await query(
        'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
        [testUser.email, passwordHash, testUser.name]
      );
      console.log(`  ✔ 사용자 생성: ${testUser.email} / ${testUser.password}`);
    } else {
      console.log(`  ✔ 사용자 이미 존재: ${testUser.email}`);
    }

    // 2. 상품 생성
    console.log('\n[2/2] 상품 데이터 생성 중...');

    // 기존 상품 확인
    const existingProducts = await query('SELECT COUNT(*) as count FROM products', []);
    const productCount = existingProducts[0].count;

    if (productCount === 0) {
      for (const product of products) {
        await query(
          `INSERT INTO products (name, description, price, image_url, category, stock)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [product.name, product.description, product.price, product.image_url, product.category, product.stock]
        );
      }
      console.log(`  ✔ ${products.length}개 상품 생성 완료`);
    } else {
      console.log(`  ✔ 상품 데이터 이미 존재 (${productCount}개)`);
    }

    // 완료
    console.log('\n========================================');
    console.log('  시드 데이터 생성 완료!');
    console.log('========================================');
    console.log(`\n  테스트 계정: ${testUser.email} / ${testUser.password}`);
    console.log(`  상품 수: ${products.length}개`);
    console.log(`  카테고리: 전자기기, 패션, 식품, 생활용품, 뷰티\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n[Seed] 오류 발생:', error);
    process.exit(1);
  }
}

seed();
