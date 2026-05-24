export async function onRequestGet(context) {
  try {
    const { MY_KV } = context.env;
    const html = await MY_KV.get(`page-${context.params.id}`);
    return html ? new Response(html, { headers: { "Content-Type": "text/html;charset=utf-8" } }) : new Response("404", { status: 404 });
  } catch {
    return new Response("error", { status: 500 });
  }
}