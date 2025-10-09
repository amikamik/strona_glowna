// Importujemy bibliotekę Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Definiujemy naszą funkcję, którą Vercel będzie uruchamiał
export default async function handler(req, res) {
  // Akceptujemy tylko żądania typu POST
  if (req.method === 'POST') {
    try {
      // Pobieramy cenę i wymiary z danych wysłanych przez kalkulator
      const { price, width, height } = req.body;

      // Prosta walidacja - sprawdzamy czy cena została podana
      if (!price || price <= 0) {
        return res.status(400).json({ error: 'Nie podano prawidłowej ceny.' });
      }

      // Tworzymy nową sesję płatności w Stripe
      const session = await stripe.checkout.sessions.create({
        // Dozwolone metody płatności dla Polski
        payment_method_types: ['card','blik'],
        // Tryb płatności - jednorazowa
        mode: 'payment',
        
        // ==================== POCZĄTEK ZMIAN ====================

        // Tworzymy trzy osobne, niestandardowe pola tekstowe.
        // Klient będzie musiał wypełnić każde z nich.
        custom_fields: [
          {
            key: 'imie_nazwisko',
            label: {
              type: 'custom',
              custom: 'Imię i Nazwisko',
            },
            type: 'text',
          },
          {
            key: 'paczkomat',
            label: {
              type: 'custom',
              custom: 'Adres lub ID Paczkomatu',
            },
            type: 'text',
          },
          {
            key: 'telefon',
            label: {
              type: 'custom',
              custom: 'Numer telefonu',
            },
            type: 'text',
          },
        ],

        // ===================== KONIEC ZMIAN =====================

        line_items: [
          {
            price_data: {
              currency: 'pln',
              unit_amount: Math.round(price * 100),
              product_data: {
                name: 'Szyba na wymiar',
                // Zgodnie z Twoją prośbą, dodajemy tutaj szczegółową instrukcję
                description: `Zamówienie na szybę o wymiarach ${height}cm x ${width}cm.\n\nWAŻNE: Prosimy o uzupełnienie poniższych pól. Adres e-mail (podany wyżej) oraz numer telefonu posłużą do wysłania powiadomień InPost.`,
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${req.headers.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/`,
      });

      // Odsyłamy z powrotem do przeglądarki link do sesji płatności
      res.status(200).json({ url: session.url });
    } catch (err) {
      // Obsługa błędów
      console.error(err);
      res.status(500).json({ error: 'Błąd serwera podczas tworzenia sesji płatności.' });
    }
  } else {
    // Jeśli ktoś spróbuje wejść na ten link inaczej niż metodą POST
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
  }
}