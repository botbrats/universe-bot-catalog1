const ZOHO_REDIRECT_URI = "https://universe-bot-catalog1.dceddocs.workers.dev/api/zoho/callback";

function html(message, status = 200) {
  return new Response(`<!doctype html><meta name="viewport" content="width=device-width"><title>Handy-Candy Zoho</title><body style="font-family:system-ui;padding:2rem"><h2>Handy-Candy + Zoho</h2><p>${message}</p></body>`, {
    status,
    headers: { "Content-Type": "text/html; charset=UTF-8" }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Start Zoho OAuth. This route redirects the account owner to Zoho.
    if (url.pathname === "/api/zoho/connect" && request.method === "GET") {
      if (!env.ZOHO_CLIENT_ID || !env.ZOHO_CLIENT_SECRET) {
        return html("Zoho OAuth secrets are not configured.", 500);
      }

      const auth = new URL("https://accounts.zoho.com/oauth/v2/auth");
      auth.searchParams.set("scope", "ZohoMail.messages.ALL");
      auth.searchParams.set("client_id", env.ZOHO_CLIENT_ID);
      auth.searchParams.set("response_type", "code");
      auth.searchParams.set("access_type", "offline");
      auth.searchParams.set("prompt", "consent");
      auth.searchParams.set("redirect_uri", ZOHO_REDIRECT_URI);

      return Response.redirect(auth.toString(), 302);
    }

    // Zoho redirects here after the account owner approves access.
    // Exchange the one-time code server-side; never expose client secrets to the browser.
    if (url.pathname === "/api/zoho/callback" && request.method === "GET") {
      const error = url.searchParams.get("error");
      if (error) return html("Zoho authorization was not completed: " + error, 400);

      const code = url.searchParams.get("code");
      if (!code) return html("Missing Zoho authorization code.", 400);

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

      // Cloudflare Worker secrets cannot be created/changed from this Worker.
      // For safety, do not display access_token or refresh_token in the browser.
      // We only confirm whether Zoho issued the offline refresh token needed for long-lived access.
      if (tokenData.refresh_token) {
        return html("SUCCESS: Zoho authorized Handy-Candy and issued offline access. Do not repeat authorization yet. Return to ChatGPT and say: ZOHO AUTH SUCCESS.");
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

        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" +
            encodeURIComponent(apiKey),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: systemPrompt }] }]
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          return Response.json(
            { error: data?.error?.message || "Gemini returned an error." },
            { status: response.status }
          );
        }

        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!reply) {
          return Response.json({ error: "Gemini returned no text response." }, { status: 502 });
        }

        return Response.json({ bot, reply });
      } catch (error) {
        return Response.json(
          { error: "Chat service error: " + error.message },
          { status: 500 }
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
