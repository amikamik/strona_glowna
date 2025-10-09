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
        // Lista produktów (w naszym przypadku jeden)
        line_items: [
          {
            price_data: {
              currency: 'pln',
              // Cena musi być podana w groszach (np. 123.45 zł -> 12345)
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
        
        // 1. Zbieranie adresu (dla Imienia i Nazwiska) - to już masz i działa
        shipping_address_collection: {
          allowed_countries: ['PL'],
        },
        
        // 2. Włączamy zbieranie numeru telefonu
        phone_number_collection: {
          enabled: true,
        },
        
        // 3. Tworzymy specjalne pole na dane paczkomatu
        custom_fields: [
          {
            key: 'paczkomat',
            label: {
              type: 'custom',
              custom: 'Adres lub numer Paczkomatu (np. KSA01M)',
            },
            type: 'text',
          },
        ],

        // 4. Definiujemy darmową wysyłkę
        shipping_options: [
            {
              shipping_rate_data: {
                type: 'fixed_amount',
                fixed_amount: {
                  amount: 0,
                  currency: 'pln',
                },
                display_name: 'Dostawa do Paczkomatu InPost',
                delivery_estimate: {
                  minimum: { unit: 'business_day', value: 1 },
                  maximum: { unit: 'business_day', value: 3 },
                },
              },
            },
        ],
        
        // ===================== KONIEC ZMIAN =====================

        // Adres, na który klient zostanie przeniesiony po udanej płatności
        success_url: `${req.headers.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
        // Adres, na który klient wróci, jeśli anuluje płatność
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