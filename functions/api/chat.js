export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    const bot = body.bot || "IT Supervisor";
    const message = body.message || "";

    if (!message.trim()) {
      return Response.json(
        { error: "Please enter a message." },
        { status: 400 }
      );
    }

    const apiKey = context.env.GEMINI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "GEMINI_API_KEY is not available to the server." },
        { status: 500 }
      );
    }

    const systemPrompt = `
You are ${bot}, a helpful assistant inside the Universe Bot Catalog.

You are assisting the user with legitimate, authorized tasks.

For IT/Security requests, provide defensive, lawful guidance.
Do not help with unauthorized access, credential theft, malware deployment,
surveillance abuse, or other harmful activity.

Be practical, organized, concise, and action-oriented.
If the user asks for a task that requires authorization, explain what
authorization is needed before taking action.

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
