export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Chat API
    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const body = await request.json();

        const bot = body.bot || "IT Supervisor";
        const message = body.message || "";

        if (!message.trim()) {
          return Response.json(
            { error: "Please enter a message." },
            { status: 400 }
          );
        }

        const apiKey = env.GEMINI_API_KEY;

        if (!apiKey) {
          return Response.json(
            { error: "GEMINI_API_KEY is not available." },
            { status: 500 }
          );
        }

        const systemPrompt = `
You are ${bot}, a helpful assistant inside the Universe Bot Catalog.

You are assisting the user with legitimate, authorized tasks.

Be practical, organized, concise, and action-oriented.

User request:
${message}
`;

        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
            encodeURIComponent(apiKey),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: systemPrompt
                    }
                  ]
                }
              ]
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          return Response.json(
            {
              error:
                data?.error?.message ||
                "Gemini returned an error."
            },
            { status: response.status }
          );
        }

        const reply =
          data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!reply) {
          return Response.json(
            { error: "Gemini returned no text response." },
            { status: 502 }
          );
        }

        return Response.json({
          bot,
          reply
        });

      } catch (error) {
        return Response.json(
          {
            error: "Chat service error: " + error.message
          },
          { status: 500 }
        );
      }
    }

    // Simple API check
    if (url.pathname === "/api/chat" && request.method === "GET") {
      return Response.json({
        status: "HANDY-CANDY API is online",
        message: "Use POST /api/chat to send a message."
      });
    }

    // Everything else continues normally
    return env.ASSETS.fetch(request);
  }
};
