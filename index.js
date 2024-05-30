require('dotenv').config();

const express = require('express');
const app = express();
const port = 3000;

app.use('/scripts', express.static(__dirname + '/node_modules/@justifi/webcomponents/dist/'));
app.use('/styles', express.static(__dirname + '/css/'));

async function getToken() {
  const requestBody = JSON.stringify({
    "client_id": process.env.CLIENT_ID,
    "client_secret": process.env.CLIENT_SECRET
  });

  console.log('REQUEST BODY:', requestBody)

  const response = await fetch('https://api.justifi.ai/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: requestBody
  })
  console.log('RESPONSE:', JSON.stringify(response))
  const data = response.json();
  return data.access_token;
}

async function makeCheckout(token) {
  const response = await fetch('https://api.justifi.ai/v1/checkouts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Sub-Account': process.env.SUB_ACCOUNT_ID,
    },
    body: JSON.stringify({
      "amount": 1799,
      "description": "One Chocolate Donut",
      "payment_method_group_id": process.env.PAYMENT_METHOD_GROUP_ID,
      "origin_url": `http://localhost:${port}`
    })
  });
  const data = await response.json();
  return data;
}

async function getWebComponentToken(token, checkoutId) {
  const response = await fetch('https://api.justifi.ai/v1/web_component_tokens', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      "resources": [`write:checkout:${checkoutId}`, `write:tokenize:${process.env.SUB_ACCOUNT_ID}`]
    })
  });
  const data = response.json();
  return data.access_token;
}

app.get('/', async (req, res) => {
  const token = await getToken();
  console.log('TOKEN:', token)
  const checkout = await makeCheckout(token);
  const webComponentToken = await getWebComponentToken(token, checkout.id);

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>JustiFi Checkout</title>
        <script type="module" src="/scripts/webcomponents/webcomponents.esm.js"></script>
        <link rel="stylesheet" href="/scripts/webcomponents/webcomponents.css">
        <link rel="stylesheet" href="/styles/theme.css">
      </head>
      <body>
        <justifi-checkout auth-token="${webComponentToken}" checkout-id="${checkout.id}">
          <div slot="insurance">
            <justifi-insurance auth-token="${webComponentToken}" checkout-id="${checkout.id}"></justifi-insurance>
          </div>
        </justifi-checkout>
      </body>
      <script>
        const justifiCheckout = document.querySelector('justifi-checkout');
        justifiCheckout.addEventListener('submitted', (event) => {
          console.log(event);
        });
        justifiCheckout.addEventListener('error-event', (event) => {
          console.log(event);
        });
      </script>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
});
