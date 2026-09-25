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

    let lastError = "Both chat models are temporarily unavailable.";
    let lastStatus = 503;
    for (const model of ["gemini-3.5-flash", "gemini-3.1-flash-lite"]) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] }) }
        );
        const data = await response.json();
        if (response.ok) {
          const reply = data?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("");
          if (reply) return Response.json({ bot, reply, model });
          lastError = "The model returned no text response.";
          lastStatus = 502;
        } else {
          lastError = data?.error?.message || "The model returned an error.";
          lastStatus = response.status;
        }
        if (![429, 500, 502, 503, 504].includes(lastStatus)) break;
      } catch (_) {
        lastError = "The chat service could not reach the model.";
        lastStatus = 503;
      }
    }
    return Response.json({ error: lastError }, { status: lastStatus });

  } catch (error) {
    return Response.json(
      {
        error: "Chat service error: " + error.message
      },
      { status: 500 }
    );
  }
}
