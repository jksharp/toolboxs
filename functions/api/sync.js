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

        if (!DB) return sendError('D1 数据库未绑定，请检查绑定名称是否为 DB', 500);

        // 测试接口
        if (request.method === 'GET' && action === 'test') {
            return new Response(JSON.stringify({ success: true, message: 'API OK', db: !!DB }), { headers });
        }

        // 上传订单（移除 BEGIN/COMMIT）
        if (request.method === 'POST' && action === 'uploadOrders') {
            let rawBody;
            try {
                rawBody = await request.text();
                if (!rawBody) throw new Error('请求体为空');
            } catch (err) {
                return sendError(`读取请求体失败: ${err.message}`);
            }

            let parsed;
            try {
                parsed = JSON.parse(rawBody);
            } catch (err) {
                return sendError(`JSON解析失败: ${err.message}。原始数据前200字符: ${rawBody.substring(0,200)}`);
            }

            const { data, mode = 'incremental' } = parsed;
            if (!data || !Array.isArray(data) || data.length === 0) {
                return sendError('数据格式错误或无有效数据');
            }

            if (data.length > 3000) return sendError('单次上传不能超过3000条，请分批上传');

            let inserted = 0, updated = 0;

            try {
                if (mode === 'full') {
                    // 先清空
                    await DB.prepare('DELETE FROM orders').run();
                    for (const item of data) {
                        await DB.prepare(`
                            INSERT INTO orders (isbn, title, price, order_qty, sent_qty, arrived_qty, received_qty, customer_name, consignment_name, discount, batch_no, report_date)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `).bind(
                            item.isbn, item.title, item.price, item.order_qty,
                            item.sent_qty, item.arrived_qty, item.received_qty,
                            item.customer_name, item.consignment_name,
                            item.discount, item.batch_no, item.report_date
                        ).run();
                        inserted++;
                    }
                } else {
                    for (const item of data) {
                        const existing = await DB.prepare(
                            'SELECT id FROM orders WHERE isbn = ? AND consignment_name = ?'
                        ).bind(item.isbn, item.consignment_name).first();

                        if (existing) {
                            await DB.prepare(`
                                UPDATE orders SET
                                    title = ?, price = ?, order_qty = ?, sent_qty = ?,
                                    arrived_qty = ?, received_qty = ?, customer_name = ?,
                                    discount = ?, batch_no = ?, report_date = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE isbn = ? AND consignment_name = ?
                            `).bind(
                                item.title, item.price, item.order_qty, item.sent_qty,
                                item.arrived_qty, item.received_qty, item.customer_name,
                                item.discount, item.batch_no, item.report_date,
                                item.isbn, item.consignment_name
                            ).run();
                            updated++;
                        } else {
                            await DB.prepare(`
                                INSERT INTO orders (isbn, title, price, order_qty, sent_qty, arrived_qty, received_qty, customer_name, consignment_name, discount, batch_no, report_date)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `).bind(
                                item.isbn, item.title, item.price, item.order_qty,
                                item.sent_qty, item.arrived_qty, item.received_qty,
                                item.customer_name, item.consignment_name,
                                item.discount, item.batch_no, item.report_date
                            ).run();
                            inserted++;
                        }
                    }
                }
                return new Response(JSON.stringify({ success: true, inserted, updated, mode, total: data.length }), { headers });
            } catch (err) {
                console.error('数据库操作失败:', err);
                return sendError(`数据库操作失败: ${err.message}`, 500);
            }
        }

        // 获取列表
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

        // 清空
        if (request.method === 'DELETE' && action === 'clear') {
            try {
                await DB.prepare('DELETE FROM orders').run();
                return new Response(JSON.stringify({ success: true }), { headers });
            } catch (err) {
                return sendError(`清空失败: ${err.message}`, 500);
            }
        }

        // 批量删除
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