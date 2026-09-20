export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
