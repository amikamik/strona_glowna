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
        payment_method_types: ['card','blik'],
        mode: 'payment',
        
        // ==================== POCZÄ„TEK FINALNYCH ZMIAN ====================

        // KROK 1: Używamy adresu ROZLICZENIOWEGO, aby zebrać IMIĘ I NAZWISKO.
        // Klient naturalnie wpisze tu swoje dane.
        billing_address_collection: 'required',

        // KROK 2: Włączamy dedykowane, obowiązkowe pole na NUMER TELEFONU.
        phone_number_collection: {
          enabled: true,
        },
        
        // KROK 3: Tworzymy własne, obowiązkowe pole na ADRES PACZKOMATU.
        custom_fields: [
          {
            key: 'paczkomat',
            label: {
              type: 'custom',
              // Ta etykieta będzie bardzo czytelna dla klienta
              custom: 'ID lub adres Paczkomatu (np. WAW01A, ul. Prosta 1)',
            },
            type: 'text',
          },
        ],

        // KROK 4: Dodajemy na górze formularza BARDZO WYRAŹNĄ INSTRUKCJĘ.
        custom_text: {
          submit: {
            message: 'Prosimy o uzupełnienie danych niezbędnych do wysyłki Paczkomatem. Twój adres zamieszkania nie jest potrzebny.',
          },
        },
        
        // KROK 5: Zmieniamy tekst na przycisku płatności.
        submit_type: 'pay',

        // ===================== KONIEC FINALNYCH ZMIAN =====================

        line_items: [
          {
            price_data: {
              currency: 'pln',
              unit_amount: Math.round(price * 100),
              product_data: {
                name: `Szyba na wymiar ${height}cm x ${width}cm`,
                // Dodajemy informację o dostawie w opisie produktu
                description: 'Dostawa do Paczkomatu w cenie.',
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