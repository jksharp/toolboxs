export async function onRequestGet(context) {
  try {
    const { MY_KV } = context.env;
    const data = await MY_KV.get("dynamic_tools_list");
    return Response.json(data ? JSON.parse(data) : []);
  } catch (e) {
    return Response.json([]);
  }
}

export async function onRequestPut(context) {
  try {
    const { MY_KV } = context.env;
    const list = await context.request.json().catch(() => []); // 👈 加固这里
    await MY_KV.put("dynamic_tools_list", JSON.stringify(list));
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ success: false, error: e.message });
  }
}