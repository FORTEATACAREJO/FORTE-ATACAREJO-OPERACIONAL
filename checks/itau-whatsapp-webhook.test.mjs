import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import { request } from "node:http";
import { test } from "node:test";

test("Itaú gateway forwards the exact signed WhatsApp bytes", async (t) => {
  process.env.PORT = "0";
  process.env.WHATSAPP_APP_SECRET = "synthetic-meta-secret";
  process.env.WHATSAPP_VENDAS_WEBHOOK_ENABLED = "true";
  const delivery = t.mock.method(globalThis, "fetch", async () => new Response("ok"));
  const { server } = await import("../itau-server.mjs");
  t.after(() => new Promise(resolve => server.close(resolve)));
  if (!server.listening) await once(server, "listening");

  const body = Buffer.from('{"message":"Cimento para São João"}');
  const split = body.indexOf(Buffer.from("ã")) + 1;
  const signature = "sha256=" + createHmac("sha256", process.env.WHATSAPP_APP_SECRET).update(body).digest("hex");
  for (const path of ["/webhook", "/webhooks/whatsapp"]) {
    const status = await new Promise((resolve, reject) => {
      const req = request({
        hostname: "127.0.0.1",
        port: server.address().port,
        path,
        method: "POST",
        headers: { "x-hub-signature-256": signature },
      }, (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      });
      req.on("error", reject);
      req.write(body.subarray(0, split));
      setImmediate(() => req.end(body.subarray(split)));
    });
    assert.equal(status, 200);
  }
  assert.equal(delivery.mock.callCount(), 4);
  for (const { arguments: [, { body: forwarded, headers }] } of delivery.mock.calls) {
    assert.deepEqual(forwarded, body);
    assert.equal(headers["x-hub-signature-256"], signature);
  }
});
