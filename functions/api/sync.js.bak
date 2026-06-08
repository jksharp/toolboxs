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

    try {
        const DB = env.DB;
        const url = new URL(request.url);
        const action = url.searchParams.get('action');

        // 测试接口
        if (request.method === 'GET' && action === 'test') {
            return new Response(JSON.stringify({ success: true, message: 'API is working' }), { headers });
        }

        // 上传订单
        if (request.method === 'POST' && action === 'uploadOrders') {
            let rawBody;
            try {
                rawBody = await request.text();
                if (!rawBody) throw new Error('请求体为空');
                const parsed = JSON.parse(rawBody);
                var { data, mode = 'incremental' } = parsed;
            } catch (err) {
                return new Response(JSON.stringify({ success: false, error: `JSON解析失败: ${err.message}` }), { status: 400, headers });
            }

            if (!data || !data.length) {
                return new Response(JSON.stringify({ success: false, error: '无有效数据' }), { headers });
            }

            // 限制单次上传最大条数，防止请求过大
            if (data.length > 5000) {
                return new Response(JSON.stringify({ success: false, error: '单次上传不能超过5000条，请分批上传' }), { headers });
            }

            let inserted = 0, updated = 0;
            await DB.prepare('BEGIN').run();

            try {
                if (mode === 'full') {
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
                await DB.prepare('COMMIT').run();
                return new Response(JSON.stringify({ success: true, inserted, updated, mode, total: data.length }), { headers });
            } catch (err) {
                await DB.prepare('ROLLBACK').run();
                console.error('数据库操作失败:', err);
                return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers });
            }
        }

        // 列表、清空、删除等接口保持不变...
        if (request.method === 'GET' && action === 'list') {
            // ... (与之前相同)
        }
        // ... 其他处理

        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers });
    } catch (err) {
        console.error('API 错误:', err);
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers });
    }
}