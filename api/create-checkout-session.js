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
        payment_method_types: ['card', 'blik'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'pln',
              unit_amount: Math.round(price * 100),
              product_data: {
                name: 'Szyba na wymiar',
                description: `Zamówienie na szybę o wymiarach ${height}cm x ${width}cm`,
              },
            },
            quantity: 1,
          },
        ],
        
        // ==================== POCZĄTEK ZMIAN ====================
        
        // KROK 1: Włączamy zbieranie numeru telefonu.
        // Stripe doda pole "Numer telefonu" do formularza.
        phone_number_collection: {
          enabled: true,
        },

        // KROK 2: Włączamy standardowe zbieranie adresu (dla Imienia, Nazwiska itp.)
        shipping_address_collection: {
          allowed_countries: ['PL'],
        },
        
        // KROK 3: Dodajemy niestandardowe pola, widoczne dla klienta.
        // To jest idealne miejsce na dane paczkomatu!
        custom_fields: [
          {
            key: 'paczkomat',
            label: {
              type: 'custom',
              custom: 'Adres lub numer Paczkomatu (np. WAW01A, ul. Prosta 1)',
            },
            type: 'text',
          },
        ],

        // KROK 4 (Opcjonalnie, ale BARDZO ZALECANE): Dodajemy tekst informacyjny.
        // Ten tekst pojawi się na stronie płatności i wyjaśni klientowi, co ma zrobić.
        custom_text: {
          shipping_address: {
            message: 'Prosimy o podanie Twoich danych (Imię, Nazwisko) oraz wklejenie pełnego adresu Paczkomatu w polach adresu dostawy.',
          },
        },
        
        // Ta sekcja bez zmian - definiuje darmową wysyłkę
        shipping_options: [
          {
            shipping_rate_data: {
              type: 'fixed_amount',
              fixed_amount: { amount: 0, currency: 'pln' },
              display_name: 'Dostawa do Paczkomatu InPost',
              delivery_estimate: {
                minimum: { unit: 'business_day', value: 1 },
                maximum: { unit: 'business_day', value: 3 },
              },
            },
          },
        ],
        // ===================== KONIEC ZMIAN =====================

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