export async function onRequestPost(context) {
  const { MY_KV } = context.env;
  const keys = await MY_KV.list({ prefix: "tool:" });
  for (const key of keys.keys) {
    await MY_KV.delete(key.name);
  }
  return Response.json({ success: true });
}