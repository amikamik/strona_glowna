export default async function handler(req, res) {
    // Odbiera historię rozmowy od frontendu
    const { conversationHistory } = req.body;

    // Bezpiecznie pobiera klucz API, który dodałeś w panelu Vercel
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: { message: "Klucz API nie jest skonfigurowany na serwerze." }});
    }

    // Łączy się z OpenAI z serwera (BEZPIECZNIE)
    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: conversationHistory,
                temperature: 0.8
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            return res.status(response.status).json({ error: errorData.error });
        }

        const data = await response.json();

        // Odsyła odpowiedź bota z powrotem do frontendu
        res.status(200).json({ reply: data.choices[0].message.content });

    } catch (error) {
        res.status(500).json({ error: { message: error.message || "Wystąpił nieznany błąd serwera." }});
    }
}