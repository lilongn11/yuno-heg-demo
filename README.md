# Yuno Demo

A demo of three Yuno SDK integration patterns: two checkout flows with a card-country surcharge confirmation modal, and an enrollment lite flow. All pages support configurable country, amount, and currency via the index page.

## Index Page — `/`

Configure demo settings before navigating to any integration:

- **Country** — populated from the restcountries.com public API (cached in `localStorage`), with a local fallback list
- **Amount** — numeric input
- **Currency** — auto-derived from selected country

Settings are stored server-side (`POST /settings`) and applied to all subsequent session creation calls. No query parameters are used.

The enrollment section additionally shows available payment methods fetched from Yuno's customer session API. A method must be selected before the Enrollment Lite link becomes active.

---

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

Both checkout pages support an `?external=true` URL parameter that switches to external payment buttons (PayPal Enrollment, Google Pay, Apple Pay) rendered as standalone SDK buttons via `mountSeamlessExternalButtons`.

**URLs:**
- `/checkout?external=true`
- `/checkout-seamless?external=true`

**Behaviour:**
- Each button is only shown if the payment method is available in the account (detected via `MutationObserver`)
- If no external methods are available, the page automatically falls back to the regular card checkout
- The Pay Now button is hidden in external mode — each button handles its own payment flow

---

### 3. Enrollment Lite — `/enrollment-lite`

Uses the Yuno **Enrollment Lite SDK** (`mountEnrollmentLite`) to enroll a payment method into the customer vault without making a payment. The payment method to enroll is selected on the index page before navigating here.

**Flow:**
1. User selects an enrollable payment method on the index page → stored server-side
2. User navigates to `/enrollment-lite`
3. Server creates a customer session (`POST /v1/customers/sessions`)
4. Server registers the enrollment (`POST /v1/customers/sessions/{id}/payment-methods`)
5. SDK mounts the enrollment form for the selected method:
   - **CARD** → `mountEnrollmentLite` opens modal immediately on page load
   - **PAYPAL_ENROLLMENT** → `mountEnrollmentLite` renders the PayPal button inline (`renderMode: { type: 'element' }`)
6. `yunoEnrollmentStatus` callback fires with `status` and `vaultedToken` on completion

**Key files:** `pages/enrollment-lite.html`, `static/enrollment-lite.js`

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
4. Open [http://localhost:8080](http://localhost:8080) — the index page

| URL | Description |
|---|---|
| `/` | Index — configure settings and navigate |
| `/checkout` | Full Checkout |
| `/checkout-seamless` | Seamless card-only checkout |
| `/checkout?external=true` | Full Checkout → external buttons mode |
| `/checkout-seamless?external=true` | Seamless → external buttons mode |
| `/enrollment-lite` | Enrollment Lite (method selected on index page) |

## Environment variables

| Variable | Description |
|---|---|
| `ACCOUNT_CODE` | Your Yuno account code |
| `PUBLIC_API_KEY` | Your Yuno public API key |
| `PRIVATE_SECRET_KEY` | Your Yuno private secret key |

## Server endpoints

| Endpoint | Description |
|---|---|
| `GET /` | Index page |
| `GET /checkout` | Full Checkout page |
| `GET /checkout-seamless` | Seamless Checkout page |
| `GET /enrollment-lite` | Enrollment Lite page |
| `GET /settings` | Returns current demo settings |
| `POST /settings` | Updates country, amount, currency |
| `POST /checkout/sessions` | Creates a Yuno checkout session |
| `POST /checkout/seamless/sessions` | Creates a Yuno checkout session (used by external buttons mode) |
| `POST /session/update-fee` | Calculates surcharge from `tokenWithInfo`, updates Yuno session, stores fee |
| `POST /payments` | Creates the payment using server-stored fee |
| `GET /enrollment/payment-methods` | Returns enrollable payment methods via customer session API |
| `POST /enrollment/method` | Stores the selected enrollment method |
| `POST /customers/sessions` | Creates a Yuno customer session |
| `POST /customers/sessions/:id/payment-methods` | Registers a payment method for enrollment |
