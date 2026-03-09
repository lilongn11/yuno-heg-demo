# Yuno Demo

A demo of four Yuno SDK integration patterns: two checkout flows, a checkout lite flow, and an enrollment lite flow — all with a card-country surcharge confirmation modal where applicable. All integrations are configurable via the index page.

## Index Page — `/`

Configure demo settings before navigating to any integration:

- **Country** — populated from the restcountries.com public API (cached in `localStorage`), with a local fallback list
- **Amount** — numeric input
- **Currency** — auto-derived from selected country

Settings are stored server-side (`POST /settings`) and applied to all subsequent session creation calls. No query parameters are used.

The index page has three collapsible folders — only one can be open at a time:

- **Checkout Full** — contains four links:
  - **Checkout Full** — opens the full payment method selector as an overlay directly on the index page (no navigation)
  - **Checkout Full + External Buttons** — navigates to `/checkout?external=true`
  - **Seamless Checkout** — navigates to `/checkout-seamless`
  - **Seamless + External Buttons** — navigates to `/checkout-seamless?external=true`
- **Checkout Lite** — shows available payment methods when unfolded; select a method then click **Continue With Selected** to open the checkout lite modal directly on the index page
- **Enrollment** — shows enrollable payment methods when unfolded; select a method then click **Enrollment Lite** to open the enrollment modal directly on the index page

Payment methods are only fetched when a folder is opened or when **Apply Settings** is clicked (while the folder is open). Methods reset when settings change.

---

## Integrations

### 1. Full Checkout — inline overlay (index page) and `/checkout`

Uses the Yuno **Full Checkout SDK** (`startCheckout` + `mountCheckout`). The SDK renders a payment method selector; the user picks a method and clicks **Pay Now** to proceed. For card payments, a surcharge confirmation modal is shown before the payment is created.

**Inline variant (index page overlay):**

Clicking **Checkout Full** in the folder opens an overlay on the index page — no navigation required. The SDK mounts inside a dedicated `#checkout-full-root` container (separate from `#root` used by Checkout Lite to avoid conflicts). An × button and clicking the dark backdrop both close the overlay.

**Flow (both inline and `/checkout` page):**
1. SDK renders the full payment method list
2. User selects any method → **Pay Now** button appears
3. For **CARD**: surcharge notice appears; user clicks **Pay Now** → card form opens
4. SDK tokenises the card → `yunoCreatePayment` fires
5. Frontend sends `tokenWithInfo` to server → server calculates surcharge rate
6. Confirmation modal shows: card origin, rate, base amount, fee, total
7. **Confirm & Pay** → payment created with server-computed fee → `continuePayment()`
8. **Use different card** → new session, card form reopens automatically
9. **Change payment method** → returns to method selector
10. For **non-card methods**: payment goes straight through without surcharge modal

**Key files:** `pages/index.html` (inline script), `pages/checkout.html`, `static/checkout.js`

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

Both checkout pages support an `?external=true` URL parameter that switches to external payment buttons (PayPal, Google Pay, Apple Pay) rendered as standalone SDK buttons via `mountSeamlessExternalButtons`.

**URLs:**
- `/checkout?external=true`
- `/checkout-seamless?external=true`

**Behaviour:**
- Each button is only shown if the payment method is available in the account (detected via `MutationObserver`)
- If no external buttons render within 8 seconds, the page automatically falls back to the regular card checkout
- The Pay Now button and SDK root card are hidden in external mode — each button handles its own payment flow
- **Apple Pay** requires HTTPS and is automatically skipped on `http://` (e.g. localhost) to avoid browser security errors that would prevent PayPal and Google Pay from loading

---

### 3. Checkout Lite — index page (inline modal)

Uses the Yuno **Checkout Lite SDK** (`startCheckout` + `mountCheckoutLite`) to complete a payment for a specific payment method without the full method selector UI. Triggered directly from the index page — no navigation required.

**Flow:**
1. Open the **Checkout Lite** folder on the index page → available payment methods load automatically
2. Select a payment method → **Continue With Selected** button activates
3. Click **Continue With Selected** → `startCheckout` initialises the SDK; `mountCheckoutLite` opens the form as a modal
4. For **CARD**: user fills card details → `yunoCreatePayment` fires
5. Server calculates surcharge rate → confirmation modal shows: card origin, rate, base amount, fee, total
6. **Confirm & Pay** → payment created → `continuePayment()`
7. **Use different card** → new session, card form reopens
8. **Change payment method** → modal dismissed; user can select another method on the index page
9. For non-card methods: payment goes straight through without surcharge modal

**Key files:** `pages/index.html` (inline script)

---

### 4. Enrollment Lite

Uses the Yuno **Enrollment Lite SDK** (`mountEnrollmentLite`) to enroll a payment method into the customer vault without making a payment.

**Two entry points:**

**From the index page (modal, no navigation):**
1. User selects an enrollable payment method on the index page → stored server-side
2. User clicks **Enrollment Lite** link → enrollment modal opens directly on the index page
3. Server creates a customer session and registers the enrollment
4. `mountEnrollmentLite` opens a modal for the selected method
5. `yunoEnrollmentStatus` callback fires with `status` and `vaultedToken` on completion

**From `/enrollment-lite` (dedicated page):**
1. User selects a payment method on the index page and navigates to `/enrollment-lite`
2. Server creates a customer session and registers the enrollment
3. SDK mounts the enrollment form for the selected method:
   - **CARD** → `mountEnrollmentLite` opens modal immediately on page load
   - **PAYPAL_ENROLLMENT** → `mountEnrollmentLite` renders the PayPal button inline (`renderMode: { type: 'element' }`)
4. `yunoEnrollmentStatus` callback fires with `status` and `vaultedToken` on completion

**Key files:** `pages/index.html` (inline script), `pages/enrollment-lite.html`, `static/enrollment-lite.js`

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
| `GET /checkout/payment-methods` | Returns available checkout payment methods via checkout session API |
| `GET /enrollment/payment-methods` | Returns enrollable payment methods via customer session API |
| `POST /enrollment/method` | Stores the selected enrollment method |
| `POST /customers/sessions` | Creates a Yuno customer session |
| `POST /customers/sessions/:id/payment-methods` | Registers a payment method for enrollment |
