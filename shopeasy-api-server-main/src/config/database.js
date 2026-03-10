/**
 * 데이터베이스 추상화 모듈
 * - SQLite (로컬 개발)와 MySQL (AWS RDS) 모두 지원
 * - query() 함수로 SQL 실행을 통일된 인터페이스로 제공
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const DB_TYPE = process.env.DB_TYPE || 'sqlite';

// SQLite 또는 MySQL 연결 객체
let db = null;
let pool = null; // MySQL용 커넥션 풀
let dbPath = null; // SQLite 파일 경로

/**
 * 데이터베이스 초기화
 * - SQLite: sql.js (WASM 기반, 네이티브 컴파일 불필요)
 * - MySQL: mysql2/promise 커넥션 풀
 */
async function initDatabase() {
  if (DB_TYPE === 'sqlite') {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();

    dbPath = path.join(__dirname, '../../data/ecommerce.db');

    // data 디렉토리 생성
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    // 기존 DB 파일이 있으면 로드, 없으면 새로 생성
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    // 테이블 생성
    createTables();
    saveDatabase();
    console.log('[DB] SQLite 데이터베이스 초기화 완료 (sql.js)');
  } else if (DB_TYPE === 'mysql') {
    const mysql = require('mysql2/promise');
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // MySQL 테이블 생성
    await createTablesMysql();
    console.log('[DB] MySQL 데이터베이스 초기화 완료');
  } else {
    throw new Error(`지원하지 않는 DB_TYPE: ${DB_TYPE}`);
  }
}

/**
 * SQLite DB를 파일로 저장
 */
function saveDatabase() {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

/**
 * SQLite 테이블 생성
 */
function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      image_url TEXT,
      category TEXT,
      stock INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total_amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      rating INTEGER NOT NULL,
      content TEXT,
      image_urls TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
}

/**
 * MySQL 테이블 생성
 */
async function createTablesMysql() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(100) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price INT NOT NULL,
      image_url VARCHAR(500),
      category VARCHAR(100),
      stock INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS cart_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      total_amount INT NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      product_id INT NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      quantity INT NOT NULL,
      price INT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`,
    `CREATE TABLE IF NOT EXISTS reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      user_id INT NOT NULL,
      user_name VARCHAR(100) NOT NULL,
      rating INT NOT NULL,
      content TEXT,
      image_urls TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
  ];

  for (const sql of tables) {
    await pool.execute(sql);
  }
}

/**
 * SQL 쿼리 실행 (통합 인터페이스)
 * - SELECT: 결과 배열 반환
 * - INSERT: { insertId } 반환
 * - UPDATE/DELETE: { changes } 반환
 *
 * @param {string} sql - SQL 쿼리 (? 플레이스홀더 사용)
 * @param {Array} params - 파라미터 배열
 * @returns {Promise<any>} 쿼리 결과
 */
async function query(sql, params = []) {
  if (DB_TYPE === 'sqlite') {
    return querySqlite(sql, params);
  } else {
    return queryMysql(sql, params);
  }
}

/**
 * SQLite 쿼리 실행 (sql.js)
 */
function querySqlite(sql, params = []) {
  const trimmed = sql.trim().toUpperCase();

  if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
    // SELECT 쿼리: 결과를 객체 배열로 반환
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);

    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } else if (trimmed.startsWith('INSERT')) {
    // INSERT 쿼리: insertId 반환
    db.run(sql, params);
    const lastId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
    const changes = db.getRowsModified();
    saveDatabase();
    return { insertId: lastId, changes };
  } else {
    // UPDATE, DELETE 등: changes 반환
    db.run(sql, params);
    const changes = db.getRowsModified();
    saveDatabase();
    return { changes };
  }
}

/**
 * MySQL 쿼리 실행
 */
async function queryMysql(sql, params = []) {
  const trimmed = sql.trim().toUpperCase();

  if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } else if (trimmed.startsWith('INSERT')) {
    const [result] = await pool.execute(sql, params);
    return { insertId: result.insertId, changes: result.affectedRows };
  } else {
    const [result] = await pool.execute(sql, params);
    return { changes: result.affectedRows };
  }
}

/**
 * 데이터베이스 객체 직접 접근 (특수한 경우에만 사용)
 */
function getDb() {
  if (DB_TYPE === 'sqlite') return db;
  return pool;
}

module.exports = { initDatabase, query, getDb };
