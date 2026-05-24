export async function onRequestGet(context) {
  try {
    const { MY_KV } = context.env;
    const data = await MY_KV.get("page-list");
    return Response.json(data ? JSON.parse(data) : []);
  } catch (e) {
    return Response.json([]);
  }
}

export async function onRequestPost(context) {
  try {
    const { MY_KV } = context.env;
    const body = await context.request.json();
    const { id, name, desc, icon, html } = body;

    await MY_KV.put(`page-${id}`, html);

    const list = await MY_KV.get("page-list").then(d => d ? JSON.parse(d) : []);
    const idx = list.findIndex(x => x.id === id);
    if (idx >= 0) {
      list[idx] = { id, name, desc, icon };
    } else {
      list.push({ id, name, desc, icon });
    }

    await MY_KV.put("page-list", JSON.stringify(list));
    return Response.json({ ok: 1 });
  } catch (e) {
    return Response.json({ ok: 0 });
  }
}

export async function onRequestDelete(context) {
  try {
    const { MY_KV } = context.env;
    const { id } = await context.request.json();
    await MY_KV.delete(`page-${id}`);

    const list = await MY_KV.get("page-list").then(d => d ? JSON.parse(d) : []);
    await MY_KV.put("page-list", JSON.stringify(list.filter(x => x.id !== id)));
    return Response.json({ ok: 1 });
  } catch {
    return Response.json({ ok: 0 });
  }
}