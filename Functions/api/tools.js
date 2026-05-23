export async function onRequestGet(context) {
  try {
    console.log("=== 读取KV请求 ==="); // 控制台日志
    const { MY_KV } = context.env;
    // 打印绑定是否存在（关键！）
    console.log("KV绑定是否存在：", !!MY_KV);
    
    const data = await MY_KV.get("dynamic_tools_list");
    console.log("读取到的KV数据：", data || "空");
    return Response.json(data ? JSON.parse(data) : [], { status: 200 });
  } catch (e) {
    console.error("读取KV失败：", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function onRequestPut(context) {
  try {
    console.log("=== 写入KV请求 ===");
    const { MY_KV } = context.env;
    console.log("KV绑定是否存在：", !!MY_KV);
    
    const list = await context.request.json();
    console.log("要写入的列表：", list); // 打印要存的数据
    
    await MY_KV.put("dynamic_tools_list", JSON.stringify(list));
    console.log("写入KV成功！");
    return Response.json({ success: true, msg: "写入云端KV成功" }, { status: 200 });
  } catch (e) {
    console.error("写入KV失败：", e.message);
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}