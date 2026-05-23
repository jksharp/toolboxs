// functions/api/d1.js
export async function onRequest(context) {
  const { request, env } = context;
  const DB = env.DB;

  // 处理 CORS（因为你的前端也是 Pages 同域，其实可以不加，但保留方便调试）
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: {
      ...headers,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }});
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const { action, data } = await request.json();
    let result;

    switch (action) {
      // ---------- 用户登录 ----------
      case 'login': {
        const { no, pwd } = data;
        const stmt = await DB.prepare('SELECT * FROM users WHERE no = ? AND pwd = ?').bind(no, pwd).first();
        result = stmt || null;
        break;
      }

      // ---------- 绩效项目 ----------
      case 'getItems': {
        const rows = await DB.prepare('SELECT * FROM items').all();
        result = rows.results;
        break;
      }
      case 'setItems': {
        // 先清空再批量插入（简化，实际可做 upsert）
        await DB.prepare('DELETE FROM items').run();
        for (const item of data) {
          await DB.prepare('INSERT INTO items (id, cat, name, perScore) VALUES (?, ?, ?, ?)')
            .bind(item.id, item.cat, item.name, item.perScore).run();
        }
        result = { success: true };
        break;
      }

      // ---------- 月份列表 ----------
      case 'getMonthList': {
        const rows = await DB.prepare('SELECT * FROM month_list ORDER BY name').all();
        result = rows.results;
        break;
      }
      case 'setMonthList': {
        await DB.prepare('DELETE FROM month_list').run();
        for (const m of data) {
          await DB.prepare('INSERT INTO month_list (id, name, year, quarter) VALUES (?, ?, ?, ?)')
            .bind(m.id, m.name, m.year, m.quarter).run();
        }
        result = { success: true };
        break;
      }

      // ---------- 月份数据（整体替换，因为数据结构复杂）----------
      // 注意：monthsData 是一个对象，key = month_id, value = { items, counts, leaderScores }
      case 'getMonthsData': {
        const monthsData = {};
        const monthIds = await DB.prepare('SELECT id FROM month_list').all();
        for (const { id: monthId } of monthIds.results) {
          // 获取 items
          const items = await DB.prepare('SELECT item_id as id, cat, name, perScore FROM month_items WHERE month_id = ?').bind(monthId).all();
          // 获取 counts
          const countsRows = await DB.prepare('SELECT emp_id, item_id, times FROM counts WHERE month_id = ?').bind(monthId).all();
          const counts = {};
          for (const row of countsRows.results) {
            if (!counts[row.emp_id]) counts[row.emp_id] = {};
            counts[row.emp_id][row.item_id] = row.times;
          }
          // 获取 leaderScores
          const leaderRows = await DB.prepare('SELECT emp_id, score FROM leader_scores WHERE month_id = ?').bind(monthId).all();
          const leaderScores = {};
          for (const row of leaderRows.results) {
            leaderScores[row.emp_id] = row.score;
          }
          monthsData[monthId] = {
            items: items.results.map(i => ({ ...i, id: i.id })),
            counts,
            leaderScores
          };
        }
        result = monthsData;
        break;
      }
      case 'setMonthsData': {
        // 先删除旧数据
        await DB.prepare('DELETE FROM month_items').run();
        await DB.prepare('DELETE FROM counts').run();
        await DB.prepare('DELETE FROM leader_scores').run();
        for (const [monthId, monthData] of Object.entries(data)) {
          // 插入 items 快照
          for (const item of monthData.items) {
            await DB.prepare('INSERT INTO month_items (month_id, item_id, cat, name, perScore) VALUES (?, ?, ?, ?, ?)')
              .bind(monthId, item.id, item.cat, item.name, item.perScore).run();
          }
          // 插入 counts
          for (const [empId, empCounts] of Object.entries(monthData.counts)) {
            for (const [itemId, times] of Object.entries(empCounts)) {
              await DB.prepare('INSERT OR REPLACE INTO counts (month_id, emp_id, item_id, times) VALUES (?, ?, ?, ?)')
                .bind(monthId, empId, itemId, times).run();
            }
          }
          // 插入 leaderScores
          for (const [empId, score] of Object.entries(monthData.leaderScores)) {
            await DB.prepare('INSERT OR REPLACE INTO leader_scores (month_id, emp_id, score) VALUES (?, ?, ?)')
              .bind(monthId, empId, score).run();
          }
        }
        result = { success: true };
        break;
      }

      // ---------- 人员 ----------
      case 'getPersons': {
        const rows = await DB.prepare('SELECT * FROM persons').all();
        result = rows.results;
        break;
      }
      case 'setPersons': {
        await DB.prepare('DELETE FROM persons').run();
        for (const p of data) {
          await DB.prepare('INSERT INTO persons (id, name, groupId, position) VALUES (?, ?, ?, ?)')
            .bind(p.id, p.name, p.groupId, p.position).run();
        }
        result = { success: true };
        break;
      }

      // ---------- 组 ----------
      case 'getGroups': {
        const rows = await DB.prepare('SELECT * FROM groups').all();
        result = rows.results;
        break;
      }
      case 'setGroups': {
        await DB.prepare('DELETE FROM groups').run();
        for (const g of data) {
          await DB.prepare('INSERT INTO groups (id, name) VALUES (?, ?)').bind(g.id, g.name).run();
        }
        result = { success: true };
        break;
      }

      // ---------- 用户管理（前端users数组）----------
      case 'getUsers': {
        const rows = await DB.prepare('SELECT no, role, realName, empId FROM users').all();
        // 出于安全，不返回密码（但在登录接口里已经用了），前端可另存
        result = rows.results.map(u => ({ ...u, pwd: '' }));
        break;
      }
      case 'setUsers': {
        await DB.prepare('DELETE FROM users').run();
        for (const u of data) {
          await DB.prepare('INSERT INTO users (no, pwd, role, realName, empId) VALUES (?, ?, ?, ?, ?)')
            .bind(u.no, u.pwd, u.role, u.realName, u.empId).run();
        }
        result = { success: true };
        break;
      }

      // ---------- 日志 ----------
      case 'getLogs': {
        const rows = await DB.prepare('SELECT * FROM logs ORDER BY timestamp DESC').all();
        result = rows.results;
        break;
      }
      case 'setLogs': {
        await DB.prepare('DELETE FROM logs').run();
        for (const log of data) {
          await DB.prepare(`INSERT INTO logs (employeeId, employeeName, itemId, itemName, changeValue, reason, timestamp, monthKey)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(log.employeeId, log.employeeName, log.itemId, log.itemName, log.changeValue, log.reason, log.timestamp, log.monthKey).run();
        }
        result = { success: true };
        break;
      }

      // ---------- 当前月份 ----------
      case 'getCurMonthId': {
        const row = await DB.prepare('SELECT value FROM app_config WHERE key = "curMonthId"').first();
        result = row ? row.value : '';
        break;
      }
      case 'setCurMonthId': {
        await DB.prepare('REPLACE INTO app_config (key, value) VALUES ("curMonthId", ?)').bind(data).run();
        result = { success: true };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers });
    }

    return new Response(JSON.stringify({ success: true, data: result }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers });
  }
}