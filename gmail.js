const headers = { "Cache-Control": "no-store" };
const json = (data, status = 200) => Response.json(data, { status, headers });
const allowedSender = "shopclubhostings@gmail.com";

async function accessToken(env) {
  const sender = await env.OAUTH_TOKENS.get("google_sender");
  const refresh = await env.OAUTH_TOKENS.get("google_refresh_token");
  if (!sender || sender.toLowerCase() !== allowedSender || !refresh) {
    throw Object.assign(new Error("The authorized Gmail mailbox is not connected."), { status: 503 });
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET
    }),
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw Object.assign(new Error("Gmail authentication failed. Reconnect the authorized mailbox."), { status: 502 });
  }
  return data.access_token;
}
function decodeBase64Url(value) {
  if (!value) return "";
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}
function header(payload, name) {
  return (payload?.headers || []).find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}
function bodyText(payload) {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return decodeBase64Url(payload.body.data);
  const parts = payload.parts || [];
  for (const part of parts) {
    const found = bodyText(part);
    if (found) return found;
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
      .replace(/<\/(p|div|li|br|tr|h[1-6])\s*>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
      .replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"');
  }
  return "";
}
async function googleFetch(path, token) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/" + path, {
    headers: { Authorization: "Bearer " + token },
    signal: AbortSignal.timeout(20000)
  });
  const data = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(data?.error?.message || "Gmail could not load this mailbox item."), { status: response.status === 404 ? 404 : 502 });
  }
  return data;
}
export async function gmailRoute(request, env) {
  try {
    const token = await accessToken(env);
    const url = new URL(request.url);
    if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
    if (url.pathname === "/api/email/inbox") {
      const maxResults = Math.min(50, Math.max(1, Number(url.searchParams.get("maxResults")) || 25));
      const q = (url.searchParams.get("q") || "in:inbox").slice(0, 200);
      const list = await googleFetch("messages?maxResults=" + maxResults + "&q=" + encodeURIComponent(q), token);
      const messages = await Promise.all((list.messages || []).map(async item => {
        const m = await googleFetch("messages/" + encodeURIComponent(item.id) + "?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID&metadataHeaders=Reply-To&metadataHeaders=References", token);
        return {
          id: m.id, threadId: m.threadId, snippet: m.snippet || "",
          from: header(m.payload, "From"), to: header(m.payload, "To"),
          subject: header(m.payload, "Subject") || "(no subject)",
          date: header(m.payload, "Date"), messageId: header(m.payload, "Message-ID")
        };
      }));
      return json({ messages, nextPageToken: list.nextPageToken || null, resultSizeEstimate: list.resultSizeEstimate || 0 });
    }
    const match = url.pathname.match(/^\/api\/email\/thread\/([A-Za-z0-9_-]{1,200})$/);
    if (match) {
      const thread = await googleFetch("threads/" + encodeURIComponent(match[1]) + "?format=full", token);
      const messages = (thread.messages || []).map(m => ({
        id: m.id, threadId: m.threadId, from: header(m.payload, "From"),
        to: header(m.payload, "To"), subject: header(m.payload, "Subject") || "(no subject)",
        date: header(m.payload, "Date"), messageId: header(m.payload, "Message-ID"),
        inReplyTo: header(m.payload, "In-Reply-To"), references: header(m.payload, "References"),
        replyTo: header(m.payload, "Reply-To"), body: bodyText(m.payload)
      }));
      return json({ threadId: thread.id, messages });
    }
    return json({ error: "Not found." }, 404);
  } catch (error) {
    return json({ error: error.message || "Gmail request failed." }, error.status || 502);
  }
}
