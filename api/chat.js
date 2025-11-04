// Importujemy moduły 'fs' (file system) i 'path' do czytania plików
const fs = require('fs');
const path = require('path');

// Używamy starszej składni, którą Vercel na pewno zrozumie
module.exports = async (req, res) => {
    
    // --- SEKCJA WCZYTANIA PRODUKTÓW (BEZ ZMIAN) ---
    let productData = [];
    try {
        const filePath = path.join(process.cwd(), 'produkty.json');
        const fileContent = fs.readFileSync(filePath, 'utf8');
        productData = JSON.parse(fileContent);
    } catch (err) {
        console.error("BŁĄD KRYTYCZNY: Nie mogłem wczytać pliku produkty.json.", err);
    }
    // --- KONIEC SEKCJI ---


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

    // --- KROK 1: ZMIANA OSOBOWOŚCI (NADPISANIE) ---
    // Niezależnie od tego, co wysłał klient (nawet jeśli to stary Gbur),
    // nadpisujemy prompt systemowy na "Eksperta".
    if (conversationHistory && conversationHistory.length > 0 && conversationHistory[0].role === 'system') {
        conversationHistory[0].content = `Jesteś "Ekspertem Tothemoonshine", światowej klasy, przyjaznym i niezwykle pomocnym asystentem zakupowym.
        Twoim celem jest aktywne pomaganie klientom w znalezieniu idealnego produktu.
        - ZADAWAJ DODATKOWE PYTANIA, aby lepiej zrozumieć potrzeby klienta (np. "Do jakich ćwiczeń go potrzebujesz?", "Jaki masz budżet?").
        - Bądź entuzjastyczny, kompetentny i proaktywny.
        - Kiedy polecasz produkty, krótko wyjaśnij, dlaczego właśnie ten produkt pasuje do zapytania klienta.
        - Zawsze trzymaj się faktów z podanego KONTEKSTU PRODUKTÓW. Nie wymyślaj produktów, cen ani linków.
        - Twoja wiedza o sklepie jest OGRANICZONA do informacji z KONTEKSTU. Jeśli nie masz informacji, powiedz "Nie mam pewności co do [X], ale mogę sprawdzić. Czego jeszcze szukasz?".`;
    }
    // --- KONIEC KROKU 1 ---


    // --- KROK 2: ULEPSZONE WZBOGACANIE PROMPTU (RAG) ---

    const userQuery = conversationHistory[conversationHistory.length - 1].content.toLowerCase();
    const searchWords = userQuery.split(' ').filter(word => word.length > 2); 

    // ULEPSZONA LOGIKA WYSZUKIWANIA: Szukamy w nazwie i opisie (jeśli istnieje)
    const matchedProducts = productData.filter(product => {
        let productText = product.nazwa ? product.nazwa.toLowerCase() : '';
        // Dodaj inne pola, które chcesz przeszukiwać, np. opis_krotki, opis_dlugi
        productText += product.opis ? ' ' + product.opis.toLowerCase() : ''; 
        productText += product.opis_krotki ? ' ' + product.opis_krotki.toLowerCase() : ''; 

        if (productText === '') return false;
        return searchWords.some(word => productText.includes(word));
    });

    const topMatches = matchedProducts.slice(0, 3); // Bierzemy max 3

    let messagesForOpenAI = [...conversationHistory];

    if (topMatches.length > 0) {
        // ULEPSZONY KONTEKST: Przesyłamy więcej danych (w tym opis)
        const productContext = topMatches.map(p => 
            `Nazwa: ${p.nazwa}, Cena: ${p.cena}, Opis: ${p.opis_krotki || p.opis || 'Brak opisu.'}`
        ).join('; \n');
        
        // NOWY PROMPT KONTEKSTU: Każe botu być pomocnym
        const contextMessage = {
            role: "system",
            content: `### KONTEKST PRODUKTÓW (NAJWAŻNIEJSZE!) ###
            Klient zapytał o: "${userQuery}".
            Znalazłem w sklepie pasujące produkty. Twoim zadaniem jest UŻYĆ TYCH DANYCH, aby mu pomóc:
            [
            ${productContext}
            ]
            - Użyj TYLKO tych informacji. Nie wymyślaj produktów.
            - Aktywnie poleć mu jeden z nich i wyjaśnij, dlaczego pasuje, bazując na opisie.
            ### KONIEC KONTEKSTU ###`
        };

        messagesForOpenAI.splice(messagesForOpenAI.length - 1, 0, contextMessage);
    }
    // --- KONIEC KROKU 2 ---


    // 3. Bezpiecznie wysyłamy zapytanie do OpenAI z naszego serwera
    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo", // Możesz rozważyć gpt-4o dla jeszcze mądrzejszych odpowiedzi
                messages: messagesForOpenAI, // Wysyłamy WZBOGACONĄ historię
                temperature: 0.5 // Zmniejszamy temperaturę, aby był bardziej rzeczowy i mniej kreatywny
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