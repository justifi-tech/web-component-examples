require('dotenv').config();

const express = require('express');
const app = express();
const port = 3000;

app.use(
  '/scripts',
  express.static(__dirname + '/node_modules/@justifi/webcomponents/dist/')
);
app.use('/styles', express.static(__dirname + '/css/'));

async function getToken() {
  const requestBody = JSON.stringify({
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
  });

  let response;
  try {
    response = await fetch('https://api.justifi.ai/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });
  } catch (error) {
    console.log('ERROR:', error);
  }

  const data = await response.json();

  return data.access_token;
}

async function makeCheckout(token) {
  const response = await fetch('https://api.justifi.ai/v1/checkouts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Sub-Account': process.env.SUB_ACCOUNT_ID,
    },
    body: JSON.stringify({
      amount: 1799,
      description: 'One Chocolate Donut',
      payment_method_group_id: process.env.PAYMENT_METHOD_GROUP_ID,
      origin_url: `http://localhost:${port}`,
    }),
  });
  const { data } = await response.json();
  return data;
}

async function getWebComponentToken(token, checkoutId) {
  const response = await fetch(
    'https://api.justifi.ai/v1/web_component_tokens',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        resources: [
          `write:checkout:${checkoutId}`,
          `write:tokenize:${process.env.SUB_ACCOUNT_ID}`,
        ],
      }),
    }
  );
  const { access_token } = await response.json();
  return access_token;
}

app.get('/', async (req, res) => {
  const token = await getToken();
  const checkout = await makeCheckout(token);
  const webComponentToken = await getWebComponentToken(token, checkout.id);

  const billingAddress = {
    name: 'John Doe',
    address_line1: '123 Main St',
    address_line2: 'Apt 4B',
    address_city: 'New York',
    address_state: 'NY',
    address_postal_code: '10001',
  };

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>JustiFi Checkout</title>
        <script type="module" src="/scripts/webcomponents/webcomponents.esm.js"></script>
        <link rel="stylesheet" href="/scripts/webcomponents/webcomponents.css">
        <link rel="stylesheet" href="/styles/theme.css">
        <link rel="stylesheet" href="/styles/example.css">
      </head>
      <body>
        <div>
          <justifi-checkout auth-token="${webComponentToken}" checkout-id="${checkout.id}"></justifi-checkout>
        </div>
        <div id="output-pane">
          Billing address data:
          <code><pre>${JSON.stringify(billingAddress)}</pre></code>
          <button id="fill-billing-address">Fill Billing Address</button>
        </div>
      </body>
      <script>
        const justifiCheckout = document.querySelector('justifi-checkout');
        const fillButton = document.getElementById('fill-billing-address');
        fillButton.addEventListener('click', () => {
          justifiCheckout.fillBillingForm(${JSON.stringify(billingAddress)});
        });
      </script>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
