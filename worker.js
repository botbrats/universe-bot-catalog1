const ZOHO_REDIRECT_URI = "https://universe-bot-catalog1.dceddocs.workers.dev/api/zoho/callback";
const CHAT_MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];

async function generateChat(prompt, apiKey) {
  let lastError = "The chat service is temporarily busy.";
  let lastStatus = 503;
  for (const model of CHAT_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
      );
      const data = await response.json();
      if (response.ok) {
        const reply = data?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("");
        if (reply) return { reply, model };
        lastError = "The model returned no text response.";
        lastStatus = 502;
      } else {
        lastError = data?.error?.message || "The model returned an error.";
        lastStatus = response.status;
      }
      // Retry only temporary model failures; invalid keys and malformed requests need a fix.
      if (![429, 500, 502, 503, 504].includes(lastStatus)) break;
    } catch (_) {
      lastError = "The chat service could not reach the model.";
      lastStatus = 503;
    }
  }
  throw Object.assign(new Error(lastError), { status: lastStatus });
}

function html(message, status = 200) {
  const safe = String(message).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return new Response(`<!doctype html><meta name="viewport" content="width=device-width"><title>Handy-Candy Zoho</title><body style="font-family:system-ui;padding:2rem"><h2>Handy-Candy + Zoho</h2><p>${safe}</p></body>`, {
    status,
    headers: { "Content-Type": "text/html; charset=UTF-8" }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Do not expose account state or connected mailbox addresses on the public site.
    if (url.pathname === "/api/zoho/diagnostics" && request.method === "GET") {
      return Response.json({ error: "Administrator sign-in required." }, { status: 403 });
    }

    // Start Zoho OAuth. This route redirects the account owner to Zoho.
    if (url.pathname === "/api/zoho/connect" && request.method === "GET") {
      if (!env.ZOHO_ALLOWED_ADDRESS || !env.ZOHO_CLIENT_ID ||
          !env.ZOHO_CLIENT_SECRET || !env.OAUTH_TOKENS) {
        return html("Zoho connection is not configured.", 503);
      }

      const auth = new URL("https://accounts.zoho.com/oauth/v2/auth");
      auth.searchParams.set("scope", "ZohoMail.messages.CREATE,ZohoMail.accounts.READ");
      auth.searchParams.set("client_id", env.ZOHO_CLIENT_ID);
      auth.searchParams.set("response_type", "code");
      auth.searchParams.set("access_type", "offline");
      auth.searchParams.set("prompt", "consent");
      auth.searchParams.set("redirect_uri", ZOHO_REDIRECT_URI);
      const state = crypto.randomUUID();
      await env.OAUTH_TOKENS.put("zoho_oauth_state:" + state, "pending", { expirationTtl: 600 });
      auth.searchParams.set("state", state);

      return Response.redirect(auth.toString(), 302);
    }

    // Zoho redirects here after the account owner approves access.
    // Exchange the one-time code server-side; never expose client secrets to the browser.
    if (url.pathname === "/api/zoho/callback" && request.method === "GET") {
      if (!env.ZOHO_ALLOWED_ADDRESS || !env.ZOHO_CLIENT_ID ||
          !env.ZOHO_CLIENT_SECRET || !env.OAUTH_TOKENS) {
        return html("Zoho connection is not configured.", 503);
      }
      const error = url.searchParams.get("error");
      if (error) return html("Zoho authorization was not completed: " + error, 400);

      const code = url.searchParams.get("code");
      if (!code) return html("Missing Zoho authorization code.", 400);
      const state = url.searchParams.get("state");
      if (!state || !/^[0-9a-f-]{36}$/.test(state) ||
          await env.OAUTH_TOKENS.get("zoho_oauth_state:" + state) !== "pending") {
        return html("Zoho connection expired. Start again.", 400);
      }
      await env.OAUTH_TOKENS.delete("zoho_oauth_state:" + state);

      const tokenBody = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: env.ZOHO_CLIENT_ID,
        client_secret: env.ZOHO_CLIENT_SECRET,
        redirect_uri: ZOHO_REDIRECT_URI,
        code
      });

      const tokenResponse = await fetch("https://accounts.zoho.com/oauth/v2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenBody
      });

      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok || tokenData.error) {
        return html("Zoho token exchange failed. Return to ChatGPT with the error name only (do not share tokens).", 502);
      }

      // Store the long-lived credential server-side only. Never display or log it.
      if (tokenData.refresh_token) {
        const accountsResponse = await fetch("https://mail.zoho.com/api/accounts", {
          headers: { Authorization: "Zoho-oauthtoken " + tokenData.access_token }
        });
        const accounts = await accountsResponse.json();
        const approved = accountsResponse.ok && Array.isArray(accounts.data) &&
          accounts.data.find(account => account.enabled &&
            account.primaryEmailAddress?.toLowerCase() === env.ZOHO_ALLOWED_ADDRESS.trim().toLowerCase());
        if (!approved) {
          return html("This Zoho account does not contain the authorized sender address. No connection was saved.", 403);
        }
        await env.OAUTH_TOKENS.put("zoho_refresh_token", tokenData.refresh_token);
        await env.OAUTH_TOKENS.put("zoho_sender", JSON.stringify({
          accountId: String(approved.accountId), address: approved.primaryEmailAddress
        }));
        await env.OAUTH_TOKENS.put("zoho_accounts_domain", "https://accounts.zoho.com");
        if (tokenData.api_domain) {
          await env.OAUTH_TOKENS.put("zoho_api_domain", tokenData.api_domain);
        }
        return html("Zoho Mail connected: " + approved.primaryEmailAddress +
          ". Sending remains locked until the approval system is built.");
      }

      return html("Zoho authorized the app, but no refresh token was returned. Return to ChatGPT and say: NO REFRESH TOKEN.");
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const body = await request.json();
        const bot = body.bot || "IT Supervisor";
        const message = body.message || "";

        if (!message.trim()) {
          return Response.json({ error: "Please enter a message." }, { status: 400 });
        }

        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "GEMINI_API_KEY is not available." }, { status: 500 });
        }

        const botInstructions = {
          "Handy-Candy": `
You are Handy-Candy, Bot #13 inside the Universe Bot Catalog.

Primary workflow:
EMAIL → draft → review → negotiate → schedule → follow up → thank → close.

Help the user prepare and manage legitimate communications and coordination tasks.

APPROVAL GATE:
- You may draft emails/messages, review wording, summarize threads, propose negotiation language, suggest prices or terms, prepare follow-ups, and propose scheduling steps.
- Before any consequential external action, pause and clearly ask for the user's explicit approval.
- Consequential actions include sending an email/message, agreeing to a price or contract term, booking/rescheduling/cancelling an appointment, accepting an offer, submitting a form, or otherwise committing the user externally.
- Never claim an external action was completed unless an authorized tool actually completed it.
- If no external-action tool is available, say the item is drafted or ready for approval, not sent/booked/completed.
- Clearly distinguish DRAFTED, READY FOR APPROVAL, APPROVED, and COMPLETED.
- Be concise, practical, organized, and action-oriented.
`
        };

        const roleInstructions =
          botInstructions[bot] ||
          "Be practical, organized, concise, and action-oriented.";

        const systemPrompt = `
You are ${bot}, a helpful assistant inside the Universe Bot Catalog.

You are assisting the user with legitimate, authorized tasks.

${roleInstructions}

User request:
${message}
`;

        const { reply, model } = await generateChat(systemPrompt, apiKey);
        return Response.json({ bot, reply, model });
      } catch (error) {
        return Response.json(
          { error: error.status === 503 ? "Both chat models are temporarily unavailable. Please retry shortly." : error.message },
          { status: error.status || 500 }
        );
      }
    }

    if (url.pathname === "/api/chat" && request.method === "GET") {
      return Response.json({
        status: "HANDY-CANDY API is online",
        message: "Use POST /api/chat to send a message."
      });
    }

    return env.ASSETS.fetch(request);
  }
};
