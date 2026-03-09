# Yuno Checkout Demo — HEG

A demo of two Yuno SDK integration patterns, both implementing a card-country surcharge flow with a confirmation modal. Both pages also support an optional external payment buttons mode.

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

**Key files:** `pages/checkout.html`, `static/checkout.js`

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

**Key files:** `pages/checkout-seamless.html`, `static/checkout-seamless.js`

---

### External Payment Buttons Mode — `?external=true`

Both pages support an `?external=true` URL parameter that switches to external payment buttons (PayPal Enrollment, Google Pay, Apple Pay) rendered as standalone SDK buttons via `mountSeamlessExternalButtons`.

**URLs:**
- `/checkout?external=true`
- `/checkout-seamless?external=true`

**Behaviour:**
- Each button is only shown if the payment method is available in the account (detected via `MutationObserver`)
- If no external methods are available, the page automatically falls back to the regular card checkout
- The Pay Now button is hidden in external mode — each button handles its own payment flow

---

## Surcharge logic

Applies to card payments only. Rate is computed **server-side** from `tokenWithInfo.card_data.country_code`. The frontend never sends a rate.

| Card origin | Rate |
|---|---|
| Singapore-issued | 1% |
| All other cards | 2% |

---

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

| URL | Description |
|---|---|
| `/checkout` | Full Checkout (card + all methods) |
| `/checkout-seamless` | Seamless card-only checkout |
| `/checkout?external=true` | Full Checkout → external buttons mode |
| `/checkout-seamless?external=true` | Seamless → external buttons mode |

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
| `POST /checkout/seamless/sessions` | Creates a Yuno seamless checkout session (used by external mode) |
| `POST /session/update-fee` | Calculates surcharge from `tokenWithInfo`, updates Yuno session, stores fee |
| `POST /payments` | Creates the payment using server-stored fee |
