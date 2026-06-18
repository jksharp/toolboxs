# Cloudflare Page Functions 项目完整开发部署手册

## 一、项目介绍
本项目基于 Cloudflare Pages + Functions 开发，实现图书订单管理、ISBN 扫码核对、Excel 订单导入、数据统计全流程功能。
- 数据库：Cloudflare D1 关系型数据库
- 存储：Cloudflare KV 键值存储
- 前端：纯 HTML + JS，无需额外框架
- 后端：Cloudflare Page Functions，无服务器部署

## 二、项目核心文件清单
| 文件名 | 核心用途 |
|--------|----------|
| sync.html | 订单上传、扫码核对、数据查询主页面 |
| sync.js | 后端 API 接口逻辑，处理订单增删改查 |
| adminview.html | 页面管理后台，支持新增/编辑/删除自定义页面 |
| _routes.json | Cloudflare Pages 路由配置，定义接口和页面访问路径 |
| wrangler.toml | Cloudflare 核心配置文件，绑定 D1 数据库和 KV 存储 |

## 三、环境安装（第一次使用必做，4步搞定）
1. 安装 Node.js LTS 长期支持版（官网下载，安装时勾选「Add to PATH」）
2. 打开 Windows 终端/命令提示符，执行安装 Wrangler 工具：`npm install -g wrangler`
3. 执行登录命令，关联你的 Cloudflare 账号：`wrangler login`
4. 验证安装是否成功：`wrangler -v`，输出版本号即为正常

## 四、核心配置文件说明
### 4.1 wrangler.toml 核心配置
```toml
name = "toolboxs"                  # 你的项目名称，Cloudflare 后台显示
pages_build_output_dir = "./"      # 站点根目录，固定为当前文件夹
[[kv_namespaces]]
binding = "MY_KV"                  # KV 存储绑定名，代码中通过 env.MY_KV 调用
id = "你的KV命名空间ID"             # 替换为 Cloudflare 后台的 KV 命名空间 ID
[[d1_databases]]
binding = "DB"                     # D1 数据库绑定名，代码中通过 env.DB 调用
database_name = "erp_db"           # 你的 D1 数据库名称
database_id = "你的D1数据库ID"       # 替换为 Cloudflare 后台的 D1 数据库 ID
```

### 4.2 _routes.json 路由配置
```json
{
  "version": 1,
  "include": [
    "/tool*",        // 自定义页面访问路径，如 /tool1001
    "/api-pages",    // 页面管理后台接口
    "/api/tools",    // 工具类接口
    "/api/sync*"     // 订单同步核心接口
  ],
  "exclude": []
}
```

## 五、D1 数据库表结构（带完整字段注释，可直接执行）
### 5.1 订单主表：orders
存储从 Excel 导入的图书订单核心数据，支持增量/全量更新，通过「书号+馆配名称」做唯一约束，避免重复数据。
```sql
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,        -- 主键ID，自增，唯一标识每条订单
    isbn TEXT NOT NULL,                          -- 书号（ISBN），必填，图书唯一标识
    title TEXT NOT NULL,                         -- 书名，必填
    price REAL NOT NULL,                         -- 图书定价，必填，浮点型
    order_qty INTEGER DEFAULT 0,                 -- 订购数量，默认0
    sent_qty INTEGER DEFAULT 0,                  -- 已发货数量，默认0
    arrived_qty INTEGER DEFAULT 0,               -- 已到货数量，默认0
    received_qty INTEGER DEFAULT 0,              -- 已收款数量，默认0
    customer_name TEXT,                          -- 客户名称
    consignment_name TEXT,                       -- 馆配需求单名称（馆配单号）
    discount INTEGER DEFAULT 0,                  -- 需求单折扣，默认0
    batch_no TEXT,                               -- 报订批次号
    report_date TEXT,                            -- 上报日期
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 记录创建时间，默认当前系统时间
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 记录更新时间，默认当前系统时间
    UNIQUE(isbn, consignment_name)              -- 唯一约束：书号+馆配名称组合唯一，增量更新依据
);
```

### 5.2 扫码记录表：scan_records
存储图书扫码核对的明细数据，支持按包裹、书号快速查询，配套索引提升查询效率。
```sql
CREATE TABLE IF NOT EXISTS scan_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,        -- 主键ID，自增
    isbn TEXT NOT NULL,                          -- 书号（ISBN），必填
    title TEXT,                                  -- 书名，非必填，可从订单表关联获取
    qty INTEGER NOT NULL,                        -- 本次扫码的图书数量，必填
    customer_name TEXT,                          -- 客户名称
    consignment_name TEXT,                       -- 馆配需求单名称
    price REAL,                                  -- 图书定价
    discount INTEGER,                            -- 折扣
    batch_no TEXT,                               -- 报订批次
    report_date TEXT,                            -- 上报日期
    package_name TEXT NOT NULL DEFAULT '默认包',  -- 包裹名称，默认「默认包」
    scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 扫码操作的时间，默认当前系统时间
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP   -- 记录创建时间，默认当前系统时间
);

-- 为扫码记录表创建索引，大幅提升查询速度
CREATE INDEX IF NOT EXISTS idx_scan_records_package ON scan_records(package_name);
CREATE INDEX IF NOT EXISTS idx_scan_records_isbn ON scan_records(isbn);
```

## 六、本地开发全流程（傻瓜式，跟着做就行）
1. 登录 Cloudflare 后台，进入 D1 数据库，执行上面的建表 SQL，完成数据库初始化
2. 把本项目所有文件放到同一个文件夹里，确保 wrangler.toml 配置正确
3. 双击运行 `lib/bat/dev-local.bat`，启动本地开发服务
4. 打开浏览器，访问地址：`http://localhost:8787`
5. 打开 `sync.html` 页面，即可使用订单上传、扫码核对、数据查询功能

## 七、核心接口功能说明
| 接口地址 | 核心功能 |
|----------|----------|
| /api/sync?action=uploadOrders | 上传 Excel 批量导入订单，支持增量/全量更新 |
| /api/sync?action=list | 分页查询订单列表，支持关键词搜索 |
| /api/sync?action=clear | 清空全部订单数据 |
| /api/sync?action=deleteByIds | 根据订单ID批量删除订单 |

## 八、页面管理功能说明
1. 页面 ID 自动生成，起始编号为 1001，避免重复
2. 支持页面新增、编辑、删除、下载、分享全功能
3. 页面访问地址示例：`/tool1001`、`/tool1002`
4. 所有页面数据存储在 Cloudflare KV 中，无需额外数据库

## 九、部署上线全流程
1. 本地开发、功能测试全部完成，确保无bug
2. 双击运行 `lib/bat/git-push.bat`，输入提交备注，自动拉取、提交、推送代码到 Git 仓库
3. Cloudflare Pages 会自动拉取最新代码，完成构建和部署
4. 部署完成后，访问 Cloudflare 分配的公网域名，即可正式使用

## 十、常见问题排查
1. 页面访问404：检查 _routes.json 路由配置是否正确，确保路径在 include 列表中
2. 数据库操作失败：检查 wrangler.toml 中 D1 绑定是否正确，数据库ID是否无误
3. 中文乱码：确保所有文件编码为 UTF-8 无BOM，接口返回头设置正确的编码
4. 批处理文件报错：确保 .bat 文件编码为 ANSI，不要用 UTF-8 保存

---
本文档为项目完整重建指南，包含全部配置、表结构、操作步骤，永久可用