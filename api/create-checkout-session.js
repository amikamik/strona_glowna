const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { price, name } = req.body;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card', 'blik'],
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'pln',
            unit_amount: Math.round(price * 100),
            product_data: {
              name: name,
            },
          },
          quantity: 1,
        }],
        success_url: `${req.headers.origin}/success.html`, // Strona podziękowania
        cancel_url: `${req.headers.origin}/`, // Strona powrotu w razie anulowania
      });

      res.status(200).json({ url: session.url });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Błąd serwera podczas tworzenia sesji płatności.' });
    }
  } else {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
  }
}