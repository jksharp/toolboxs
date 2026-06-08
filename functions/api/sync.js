// functions/api/sync.js
export async function onRequest(context) {
    const { request, env } = context;
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers });
    }

    function sendError(message, status = 400) {
        return new Response(JSON.stringify({ success: false, error: message }), { status, headers });
    }

    try {
        const DB = env.DB;
        const url = new URL(request.url);
        const action = url.searchParams.get('action');

        if (!DB) return sendError('D1 数据库未绑定', 500);

        // 测试接口
        if (request.method === 'GET' && action === 'test') {
            return new Response(JSON.stringify({ success: true, message: 'OK' }), { headers });
        }

        // 上传订单（增量/全量 都支持批量）
        if (request.method === 'POST' && action === 'uploadOrders') {
            let parsed;
            try {
                parsed = await request.json();
            } catch (err) {
                return sendError(`JSON解析失败: ${err.message}`);
            }

            const { data, mode = 'incremental' } = parsed;
            if (!data || !Array.isArray(data) || data.length === 0) {
                return sendError('数据格式错误或无有效数据');
            }

            // 限制单次请求数据量，避免过大（前端已经分批，此处加个保险）
            if (data.length > 2000) {
                return sendError('单次请求不能超过2000条，请分批上传');
            }

            try {
                if (mode === 'full') {
                    // 全量模式：删除所有数据并重置自增序列
                    await DB.prepare('DELETE FROM orders').run();
                    await DB.prepare("DELETE FROM sqlite_sequence WHERE name='orders'").run();
                }

                // 准备批量插入语句（增量模式使用 INSERT OR REPLACE，全量模式直接 INSERT）
                let stmts;
                if (mode === 'full') {
                    stmts = data.map(item => {
                        return DB.prepare(`
                            INSERT INTO orders (isbn, title, price, order_qty, sent_qty, arrived_qty, received_qty, customer_name, consignment_name, discount, batch_no, report_date)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `).bind(
                            item.isbn, item.title, item.price, item.order_qty,
                            item.sent_qty, item.arrived_qty, item.received_qty,
                            item.customer_name, item.consignment_name,
                            item.discount, item.batch_no, item.report_date
                        );
                    });
                } else {
                    // 增量模式：使用 INSERT OR REPLACE（依赖唯一约束）
                    stmts = data.map(item => {
                        return DB.prepare(`
                            INSERT OR REPLACE INTO orders (isbn, title, price, order_qty, sent_qty, arrived_qty, received_qty, customer_name, consignment_name, discount, batch_no, report_date, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        `).bind(
                            item.isbn, item.title, item.price, item.order_qty,
                            item.sent_qty, item.arrived_qty, item.received_qty,
                            item.customer_name, item.consignment_name,
                            item.discount, item.batch_no, item.report_date
                        );
                    });
                }
                await DB.batch(stmts);
                return new Response(JSON.stringify({ success: true, inserted: data.length, mode }), { headers });
            } catch (err) {
                console.error('数据库操作失败:', err);
                return sendError(`数据库操作失败: ${err.message}`, 500);
            }
        }

        // ---------- 获取订单列表（分页 + 搜索） ----------
        if (request.method === 'GET' && action === 'list') {
            const page = parseInt(url.searchParams.get('page') || '1');
            const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
            const keyword = url.searchParams.get('keyword') || '';
            const offset = (page - 1) * pageSize;

            try {
                let countSql = 'SELECT COUNT(*) as total FROM orders';
                let listSql = `
                    SELECT id, isbn, title, price, order_qty, customer_name, consignment_name,
                           discount, batch_no, report_date, created_at
                    FROM orders
                `;
                let params = [];
                if (keyword) {
                    const kw = `%${keyword}%`;
                    countSql += ' WHERE isbn LIKE ? OR title LIKE ? OR customer_name LIKE ? OR consignment_name LIKE ?';
                    listSql += ' WHERE isbn LIKE ? OR title LIKE ? OR customer_name LIKE ? OR consignment_name LIKE ?';
                    params = [kw, kw, kw, kw];
                }
                listSql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
                const countResult = await DB.prepare(countSql).bind(...params.slice(0,4)).first();
                const listResult = await DB.prepare(listSql).bind(...params, pageSize, offset).all();
                return new Response(JSON.stringify({
                    success: true,
                    data: listResult.results,
                    total: countResult.total,
                    page,
                    pageSize
                }), { headers });
            } catch (err) {
                return sendError(`查询失败: ${err.message}`, 500);
            }
        }

        // ---------- 清空所有订单（保留表结构，重置自增） ----------
        if (request.method === 'DELETE' && action === 'clear') {
            try {
                await DB.prepare('DELETE FROM orders').run();
                await DB.prepare("DELETE FROM sqlite_sequence WHERE name='orders'").run();
                return new Response(JSON.stringify({ success: true }), { headers });
            } catch (err) {
                return sendError(`清空失败: ${err.message}`, 500);
            }
        }

        // ---------- 批量删除 ----------
        if (request.method === 'POST' && action === 'deleteByIds') {
            const { ids } = await request.json();
            if (!ids || !ids.length) return sendError('ids 为空');
            try {
                const placeholders = ids.map(() => '?').join(',');
                await DB.prepare(`DELETE FROM orders WHERE id IN (${placeholders})`).bind(ids).run();
                return new Response(JSON.stringify({ success: true }), { headers });
            } catch (err) {
                return sendError(`删除失败: ${err.message}`, 500);
            }
        }

        return sendError('Invalid action');
    } catch (err) {
        console.error('API 顶层错误:', err);
        return sendError(`服务器内部错误: ${err.message}`, 500);
    }
}