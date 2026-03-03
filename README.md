# Yuno Checkout Demo — HEG

A demo of two Yuno SDK integration patterns, both implementing a card-country surcharge flow with a confirmation modal.

## Integrations

### 1. Full Checkout — `/checkout`

Uses the Yuno **Full Checkout SDK** (`startCheckout` + `mountCheckout`). The SDK renders a payment method selector; the user picks CARD, fills details, and the merchant intercepts payment creation.

**Flow:**
1. SDK renders the full payment method list
2. User selects CARD → surcharge notice appears (1% SG / 2% other)
3. User fills card details and clicks **Pay Now**
4. SDK tokenises the card → `yunoCreatePayment` fires
5. Frontend sends `tokenWithInfo` to server → server calculates surcharge rate
6. Confirmation modal shows: card origin, rate, base amount, fee, total
7. **Confirm & Pay** → payment created with server-computed fee → `continuePayment()`
8. **Use different card** → new session, card form reopens automatically
9. **Change payment method** → returns to method selector

**Key files:**
- `pages/checkout.html`
- `static/checkout.js`

---

### 2. Seamless Checkout — `/checkout-seamless`

Uses the Yuno **Full Checkout SDK** with `mountCheckout({ paymentMethodType: 'CARD' })` and `renderMode: { type: 'modal' }`. CARD is auto-selected — no method picker interaction required.

**Flow:**
1. SDK auto-selects CARD → surcharge notice appears immediately
2. User clicks **Pay Now** → card form opens
3. User fills card details and clicks **Pay Now** again
4. SDK tokenises the card → `yunoCreatePayment` fires
5. Frontend sends `tokenWithInfo` to server → server calculates surcharge rate and updates the Yuno checkout session amount via `PATCH /v1/checkout/sessions/{id}`
6. Confirmation modal shows: card origin, rate, base amount, fee, total
7. **Confirm & Pay** → payment created with server-computed fee → `continuePayment()`
8. **Use different card** → new session, card form reopens automatically
9. **Change payment method** → redirects to `/checkout`

**Key files:**
- `pages/checkout-seamless.html`
- `static/checkout-seamless.js`

---

## Surcharge logic

| Card origin | Rate |
|---|---|
| Singapore-issued | 1% |
| All other cards | 2% |

The rate is computed **server-side** from the `tokenWithInfo` object returned by the SDK. The frontend never sends a rate — it sends the full token data and displays what the server returns.

## Stack

Vanilla JS + Node.js / Express

## Setup

1. Clone the repo
2. Copy the sample env file and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
3. Install dependencies and start:
   ```bash
   npm install && npm start
   ```
4. Open [http://localhost:8080](http://localhost:8080)
   - Full Checkout: [http://localhost:8080/checkout](http://localhost:8080/checkout)
   - Seamless Checkout: [http://localhost:8080/checkout-seamless](http://localhost:8080/checkout-seamless)

## Environment variables

| Variable | Description |
|---|---|
| `ACCOUNT_CODE` | Your Yuno account code |
| `PUBLIC_API_KEY` | Your Yuno public API key |
| `PRIVATE_SECRET_KEY` | Your Yuno private secret key |

## Server endpoints

| Endpoint | Description |
|---|---|
| `GET /checkout` | Full Checkout page |
| `GET /checkout-seamless` | Seamless Checkout page |
| `POST /checkout/sessions` | Creates a Yuno checkout session |
| `POST /session/update-fee` | Calculates surcharge from `tokenWithInfo`, updates Yuno session, stores fee |
| `POST /payments` | Creates the payment using server-stored fee |
