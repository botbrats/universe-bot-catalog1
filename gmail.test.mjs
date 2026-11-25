import test from "node:test";
import assert from "node:assert/strict";
import { EmailQueue } from "./email.js";

function fixture() {
  const rows = new Map();
  const storage = {
    get: async key => rows.get(key),
    put: async (key, value) => rows.set(key, structuredClone(value)),
    list: async () => new Map(rows)
  };
  const kv = new Map([
    ["google_sender", "shopclubhostings@gmail.com"],
    ["google_refresh_token", "refresh-test"]
  ]);
  const env = {
    GOOGLE_CLIENT_ID: "client-test",
    GOOGLE_CLIENT_SECRET: "secret-test",
    OAUTH_TOKENS: { get: async key => kv.get(key) },
  };
  return { queue: new EmailQueue({ storage }, env) };
}
function request(path) {
  return new Request("https://candy.example" + path, {
    headers: { "X-Candy-Mail-Provider": "gmail" }
  });
}
test("Gmail inbox returns message metadata without exposing provider payloads", async () => {
  const { queue } = fixture();
  const original = globalThis.fetch;
  globalThis.fetch = async url => {
    if (String(url).includes("oauth2.googleapis.com")) return Response.json({ access_token: "access-test" });
    if (String(url).includes("/messages?")) return Response.json({ messages: [{ id: "m1", threadId: "t1" }] });
    if (String(url).includes("/messages/m1?")) return Response.json({
      id: "m1", threadId: "t1", snippet: "Hello",
      payload: { headers: [
        { name: "From", value: "sender@example.com" },
        { name: "To", value: "shopclubhostings@gmail.com" },
        { name: "Subject", value: "Hello" },
        { name: "Date", value: "Tue, 25 Nov 2026 10:00:00 -0800" }
      ] }
    });
    throw new Error("Unexpected request " + url);
  };
  try {
    const response = await queue.fetch(request("/api/email/inbox?maxResults=25&q=in%3Ainbox"));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.messages[0].threadId, "t1");
    assert.equal(data.messages[0].subject, "Hello");
  } finally { globalThis.fetch = original; }
});
test("Gmail thread reader returns plain text and reply headers", async () => {
  const { queue } = fixture();
  const original = globalThis.fetch;
  const encoded = btoa("Hello from the sender").replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
  globalThis.fetch = async url => {
    if (String(url).includes("oauth2.googleapis.com")) return Response.json({ access_token: "access-test" });
    if (String(url).includes("/threads/t1?")) return Response.json({
      id: "t1", messages: [{ id: "m1", threadId: "t1", payload: {
        mimeType: "text/plain", body: { data: encoded },
        headers: [
          { name: "From", value: "sender@example.com" },
          { name: "Subject", value: "Hello" },
          { name: "Message-ID", value: "<m1@example.com>" }
        ]
      } }]
    });
    throw new Error("Unexpected request " + url);
  };
  try {
    const response = await queue.fetch(request("/api/email/thread/t1"));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.messages[0].body, "Hello from the sender");
    assert.equal(data.messages[0].messageId, "<m1@example.com>");
  } finally { globalThis.fetch = original; }
});
test("Gmail inbox routes reject Zoho provider sessions", async () => {
  const { queue } = fixture();
  const response = await queue.fetch(new Request("https://candy.example/api/email/inbox", {
    headers: { "X-Candy-Mail-Provider": "zoho" }
  }));
  assert.equal(response.status, 403);
});
