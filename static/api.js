export async function getPublicApiKey() {
  return fetch('/public-api-key', { method: 'GET' })
    .then(resp => resp.json())
    .then(resp => resp.publicApiKey)
}

export async function getCheckoutSession() {
  return fetch('/checkout/sessions', { method: 'POST' })
    .then(resp => resp.json())
}

export async function createPayment(data) {
  return fetch('/payments', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  }).then(resp => resp.json())
}

export async function getSeamlessCheckoutSession() {
  return fetch('/checkout/seamless/sessions', { method: 'POST' })
    .then(resp => resp.json())
}

export async function updateSessionFee({ checkoutSession, tokenWithInfo }) {
  return fetch('/session/update-fee', {
    method: 'POST',
    body: JSON.stringify({ checkoutSession, tokenWithInfo }),
    headers: { 'Content-Type': 'application/json' },
  }).then(resp => resp.json())
}

export async function getCustomerSession() {
  return fetch('/customers/sessions', { method: 'POST' })
    .then(resp => resp.json())
}

export async function createEnrollment(customerSession) {
  return fetch(`/customers/sessions/${customerSession}/payment-methods`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }).then(resp => resp.json())
}
