// 获取内容列表 / 单条 / 备份
export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    const act = url.searchParams.get('act');

    // Excel 备份
    if (act === 'backup') {
      const { results } = await db.prepare(`
        SELECT c.id,c.title,c.content,c.create_time,u.nickname,ca.name as cate
        FROM gist_context c
        JOIN gist_user u ON c.user_id=u.id
        JOIN gist_category ca ON c.cate_id=ca.id
        ORDER BY c.create_time DESC
      `).all();
      const csv = [['ID','标题','内容','创建时间','作者','分类']];
      results.forEach(r=>{
        csv.push([
          r.id,r.title.replace(/,/g,'，'),r.content.replace(/\n/g,' '),
          r.create_time,r.nickname,r.cate
        ]);
      });
      return new Response(csv.join('\n'),{
        headers:{'Content-Type':'text/csv;charset=utf-8','Content-Disposition':'attachment;filename=gist_all.csv'}
      });
    }

    // 单条详情
    if (id) {
      const data = await db.prepare(`
        SELECT c.*,u.nickname,ca.name as cate
        FROM gist_context c
        JOIN gist_user u ON c.user_id=u.id
        JOIN gist_category ca ON c.cate_id=ca.id
        WHERE c.id=?
      `).bind(id).first();
      return Response.json(data||null);
    }

    // 列表
    const { results } = await db.prepare(`
      SELECT c.id,c.title,c.create_time,u.nickname,ca.name as cate
      FROM gist_context c
      JOIN gist_user u ON c.user_id=u.id
      JOIN gist_category ca ON c.cate_id=ca.id
      ORDER BY c.create_time DESC
    `).all();
    return Response.json(results);
  } catch (e) {
    return Response.json([]);
  }
}

// 创建内容
export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    const body = await context.request.json();
    const id = Math.random().toString(36).slice(2,8);
    await db.prepare(`
      INSERT INTO gist_context (id,title,content,user_id,cate_id)
      VALUES (?,?,?,?,?)
    `).bind(id,body.title,body.content,'u1',1).run();
    return Response.json({id});
  } catch (e) {
    return Response.json({error:'创建失败'});
  }
}