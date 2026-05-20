-- 用户表（存登录账号）
CREATE TABLE IF NOT EXISTS users (
  no TEXT PRIMARY KEY,
  pwd TEXT NOT NULL,
  role TEXT NOT NULL,
  realName TEXT NOT NULL,
  empId TEXT
);

-- 绩效项目模板
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  cat TEXT NOT NULL,
  name TEXT NOT NULL,
  perScore INTEGER NOT NULL
);

-- 月份列表
CREATE TABLE IF NOT EXISTS month_list (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  year TEXT NOT NULL,
  quarter TEXT NOT NULL
);

-- 月份具体数据（items 快照）
CREATE TABLE IF NOT EXISTS month_items (
  month_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  cat TEXT NOT NULL,
  name TEXT NOT NULL,
  perScore INTEGER NOT NULL,
  PRIMARY KEY (month_id, item_id)
);

-- 考核项次数（counts）
CREATE TABLE IF NOT EXISTS counts (
  month_id TEXT NOT NULL,
  emp_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  times INTEGER DEFAULT 0,
  PRIMARY KEY (month_id, emp_id, item_id)
);

-- 领导分
CREATE TABLE IF NOT EXISTS leader_scores (
  month_id TEXT NOT NULL,
  emp_id TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  PRIMARY KEY (month_id, emp_id)
);

-- 奖惩日志
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employeeId TEXT NOT NULL,
  employeeName TEXT NOT NULL,
  itemId TEXT,
  itemName TEXT,
  changeValue INTEGER,
  reason TEXT,
  timestamp TEXT,
  monthKey TEXT
);

-- 人员表
CREATE TABLE IF NOT EXISTS persons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  groupId TEXT NOT NULL,
  position TEXT NOT NULL
);

-- 组表
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- 可选：当前选中的月份
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT
);
INSERT OR IGNORE INTO app_config (key, value) VALUES ('curMonthId', '');