// Importujemy moduły 'fs' (file system) i 'path' do czytania plików
const fs = require('fs');
const path = require('path');

// Używamy starszej składni, którą Vercel na pewno zrozumie
module.exports = async (req, res) => {
    
    // --- NOWA SEKCA: WCZYTANIE PRODUKTÓW ---
    let productData = [];
    try {
        // Składamy ścieżkę do pliku produkty.json w głównym folderze projektu
        const filePath = path.join(process.cwd(), 'produkty.json');
        // Czytamy plik
        const fileContent = fs.readFileSync(filePath, 'utf8');
        productData = JSON.parse(fileContent);
    } catch (err) {
        console.error("BŁĄD KRYTYCZNY: Nie mogłem wczytać pliku produkty.json.", err);
        // Jeśli plik nie istnieje, bot będzie działał dalej, ale bez wiedzy o produktach
    }
    // --- KONIEC NOWEJ SEKCJI ---


    // 1. Odbieramy historię rozmowy od frontendu
    let conversationHistory;
    if (typeof req.body === 'string') {
        try {
            conversationHistory = JSON.parse(req.body).conversationHistory;
        } catch (e) {
            return res.status(400).json({ error: { message: "Nieprawidłowy format JSON." }});
        }
    } else {
        conversationHistory = req.body.conversationHistory;
    }

    if (!conversationHistory) {
         return res.status(400).json({ error: { message: "Brak 'conversationHistory' w zapytaniu." }});
    }
    
    // 2. Sprawdzamy, czy klucz API jest dostępny na serwerze Vercel
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: { message: "Klucz API nie jest skonfigurowany na serwerze." }});
    }

    // --- NOWA SEKCJA: WZBOGACANIE PROMPTU (RAG) ---

    // Bierzemy ostatnią wiadomość od klienta
    const userQuery = conversationHistory[conversationHistory.length - 1].content.toLowerCase();
    const searchWords = userQuery.split(' ').filter(word => word.length > 2); // Dzielimy zapytanie na słowa

    // Szukamy pasujących produktów
    const matchedProducts = productData.filter(product => {
        const productName = product.nazwa.toLowerCase();
        // Sprawdzamy, czy którekolwiek słowo z zapytania pasuje do nazwy produktu
        return searchWords.some(word => productName.includes(word));
    });

    const topMatches = matchedProducts.slice(0, 3); // Bierzemy max 3 pasujące produkty

    // Kopiujemy historię, żeby dodać do niej nowy kontekst
    let messagesForOpenAI = [...conversationHistory];

    if (topMatches.length > 0) {
        // Znaleźliśmy produkty! Tworzymy kontekst dla AI.
        const productContext = topMatches.map(p => `Nazwa: ${p.nazwa}, Cena: ${p.cena}`).join('; ');
        
        // Tworzymy nową wiadomość systemową z kontekstem
        const contextMessage = {
            role: "system",
            content: `### KONTEKST PRODUKTÓW ###
            Klient zapytał o: "${userQuery}".
            Znalazłem w sklepie pasujące produkty: [${productContext}].
            Użyj tych informacji w swojej gburowatej odpowiedzi. Zrzędliwie poleć mu jeden z nich i wspomnij o jego nazwie lub cenie. Nie wymyślaj produktów, trzymaj się tych z listy.
            ### KONIEC KONTEKSTU ###`
        };

        // Wstawiamy nasz kontekst tuż PRZED ostatnią wiadomością klienta
        messagesForOpenAI.splice(messagesForOpenAI.length - 1, 0, contextMessage);
    }
    // --- KONIEC NOWEJ SEKCJI ---


    // 3. Bezpiecznie wysyłamy zapytanie do OpenAI z naszego serwera
    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: messagesForOpenAI, // Wysyłamy WZBOGACONĄ historię
                temperature: 0.8
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Błąd z API OpenAI:", errorData);
            return res.status(response.status).json({ error: errorData.error });
        }

        const data = await response.json();
        
        // 4. Odsyłamy odpowiedź bota z powrotem do frontendu
        res.status(200).json({ reply: data.choices[0].message.content });

    } catch (error) {
        console.error("Błąd serwera (catch):", error);
        res.status(500).json({ error: { message: error.message || "Wystąpił nieznany błąd serwera." }});
    }
};