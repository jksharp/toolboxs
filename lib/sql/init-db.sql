-- 项目数据库初始化脚本
-- 登录 Cloudflare D1 控制台，执行一次即可创建所有表与索引

-- 先删除已存在的表，避免重复创建报错
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS scan_records;

-- 创建订单主表
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    isbn TEXT NOT NULL,
    title TEXT NOT NULL,
    price REAL NOT NULL,
    order_qty INTEGER DEFAULT 0,
    sent_qty INTEGER DEFAULT 0,
    arrived_qty INTEGER DEFAULT 0,
    received_qty INTEGER DEFAULT 0,
    customer_name TEXT,
    consignment_name TEXT,
    discount INTEGER DEFAULT 0,
    batch_no TEXT,
    report_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(isbn, consignment_name)
);

-- 创建扫码记录表
CREATE TABLE IF NOT EXISTS scan_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    isbn TEXT NOT NULL,
    title TEXT,
    qty INTEGER NOT NULL,
    customer_name TEXT,
    consignment_name TEXT,
    price REAL,
    discount INTEGER,
    batch_no TEXT,
    report_date TEXT,
    package_name TEXT NOT NULL DEFAULT '默认包',
    scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引，提升查询效率
CREATE INDEX IF NOT EXISTS idx_scan_records_package ON scan_records(package_name);
CREATE INDEX IF NOT EXISTS idx_scan_records_isbn ON scan_records(isbn);