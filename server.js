const express = require('express')
const path = require('path')
const fetch = require('node-fetch')
const v4 = require('uuid').v4
const { getCountryData } = require('./utils')
const open = require('open')

require('dotenv').config()

let API_URL

const ACCOUNT_CODE = process.env.ACCOUNT_CODE
const PUBLIC_API_KEY = process.env.PUBLIC_API_KEY
const PRIVATE_SECRET_KEY = process.env.PRIVATE_SECRET_KEY

const SERVER_PORT = 8080

let CUSTOMER_ID

const sessions = new Map()    // checkout_session token → { id, baseAmount, currency, country }
const sessionFees = new Map() // checkout_session token → { surchargeRate, surcharge, totalAmount }
let settings = { country: 'US', amount: 10, currency: 'USD', enrollmentMethod: null }

const staticDirectory = path.join(__dirname, 'static')
const indexPage = path.join(__dirname, 'pages/index.html')
const checkoutPage = path.join(__dirname, 'pages/checkout.html')
const checkoutSeamlessPage = path.join(__dirname, 'pages/checkout-seamless.html')
const enrollmentLitePage = path.join(__dirname, 'pages/enrollment-lite.html')

const app = express()

app.use(express.json())
app.use('/static', express.static(staticDirectory))

app.get('/', (req, res) => {
  res.sendFile(indexPage)
})

app.get('/checkout', (req, res) => {
  res.sendFile(checkoutPage)
})

app.get('/checkout-seamless', (req, res) => {
  res.sendFile(checkoutSeamlessPage)
})

app.get('/enrollment-lite', (req, res) => {
  res.sendFile(enrollmentLitePage)
})

app.get('/public-api-key', (req, res) => {
  res.json({ publicApiKey: PUBLIC_API_KEY })
})

app.get('/settings', (req, res) => {
  res.json(settings)
})

app.post('/settings', (req, res) => {
  const { country, amount, currency } = req.body
  if (!country || !amount || !currency) {
    return res.status(400).json({ error: 'country, amount, and currency are required' })
  }
  settings = { country, amount: parseInt(amount), currency }
  res.json(settings)
})

app.post('/checkout/sessions', async (req, res) => {
  const { country, amount: baseAmount, currency } = settings

  const response = await fetch(
    `${API_URL}/v1/checkout/sessions`,
    {
      method: 'POST',
      headers: {
        'public-api-key': PUBLIC_API_KEY,
        'private-secret-key': PRIVATE_SECRET_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_id: ACCOUNT_CODE,
        merchant_order_id: v4(),
        payment_description: 'HEG Demo Payment',
        country,
        customer_id: CUSTOMER_ID,
        amount: {
          currency,
          value: baseAmount,
        },
      }),
    }
  ).then((resp) => resp.json())

  if (response.checkout_session) {
    sessions.set(response.checkout_session, {
      id: response.id,
      baseAmount,
      currency,
      country,
    })
  }

  res.send(response)
})

app.post('/checkout/seamless/sessions', async (req, res) => {
  const { country, amount: baseAmount, currency } = settings

  const response = await fetch(
    `${API_URL}/v1/checkout/sessions`,
    {
      method: 'POST',
      headers: {
        'public-api-key': PUBLIC_API_KEY,
        'private-secret-key': PRIVATE_SECRET_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_id: ACCOUNT_CODE,
        merchant_order_id: v4(),
        payment_description: 'HEG Demo Payment',
        country,
        customer_id: CUSTOMER_ID,
        amount: {
          currency,
          value: baseAmount,
        },
      }),
    }
  ).then((resp) => resp.json())

  if (response.checkout_session) {
    sessions.set(response.checkout_session, {
      id: response.id,
      baseAmount,
      currency,
      country,
    })
  }

  res.send(response)
})

app.post('/session/update-fee', async (req, res) => {
  const { checkoutSession, tokenWithInfo } = req.body

  const sessionData = sessions.get(checkoutSession)
  if (!sessionData) {
    return res.status(400).json({ error: 'Session not found' })
  }

  const { id: sessionId, baseAmount, currency } = sessionData
  const cardCountryCode = tokenWithInfo?.card_data?.country_code ?? null
  const surchargeRate = cardCountryCode === 'SG' ? 0.01 : 0.02
  const surcharge = Math.round(baseAmount * surchargeRate)
  const totalAmount = baseAmount + surcharge

  await fetch(`${API_URL}/v1/checkout/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: {
      'public-api-key': PUBLIC_API_KEY,
      'private-secret-key': PRIVATE_SECRET_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: { currency, value: totalAmount },
    }),
  })

  sessionFees.set(checkoutSession, { surchargeRate, surcharge, totalAmount })

  res.json({ surchargeRate, surchargeAmount: surcharge, totalAmount, currency })
})

app.post('/payments', async (req, res) => {
  const { checkoutSession, oneTimeToken } = req.body

  const sessionData = sessions.get(checkoutSession)
  const country = sessionData?.country ?? settings.country
  const currency = sessionData?.currency ?? settings.currency
  const { documentNumber, documentType } = getCountryData(country)

  const baseAmount = sessionData?.baseAmount ?? settings.amount
  const feeData = sessionFees.get(checkoutSession)
  const surcharge = feeData?.surcharge ?? 0
  const totalAmount = feeData?.totalAmount ?? baseAmount

  const response = await fetch(`${API_URL}/v1/payments`, {
    method: 'POST',
    headers: {
      'public-api-key': PUBLIC_API_KEY,
      'private-secret-key': PRIVATE_SECRET_KEY,
      'X-idempotency-key': v4(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: 'HEG Demo Payment',
      account_id: ACCOUNT_CODE,
      merchant_order_id: v4(),
      country,
      additional_data: {
        order: {
          fee_amount: surcharge,
          items: [
            {
              brand: 'HEG',
              category: 'Services',
              id: 'HEG-001',
              name: 'HEG Service',
              quantity: 1,
              unit_amount: baseAmount,
            },
          ],
        },
      },
      amount: {
        currency,
        value: totalAmount,
      },
      checkout: {
        session: checkoutSession,
      },
      customer_payer: {
        billing_address: {
          address_line_1: 'Calle 34 # 56 - 78',
          address_line_2: 'Apartamento 502, Torre I',
          city: 'Bogota',
          country,
          state: 'Cundinamarca',
          zip_code: '111111',
        },
        date_of_birth: '1990-02-28',
        device_fingerprint: 'hi88287gbd8d7d782ge',
        document: {
          document_type: documentType,
          document_number: documentNumber,
        },
        email: 'pepitoperez@y.uno',
        first_name: 'Pepito',
        gender: 'MALE',
        id: CUSTOMER_ID,
        ip_address: '192.168.123.167',
        last_name: 'Perez',
        merchant_customer_id: 'example00234',
        nationality: country,
        phone: {
          country_code: '57',
          number: '3132450765',
        },
        shipping_address: {
          address_line_1: 'Calle 34 # 56 - 78',
          address_line_2: 'Apartamento 502, Torre I',
          city: 'Bogota',
          country,
          state: 'Cundinamarca',
          zip_code: '111111',
        },
      },
      payment_method: {
        token: oneTimeToken,
        vaulted_token: null,
      },
    }),
  }).then((resp) => resp.json())

  res.json(response)
})

app.get('/enrollment/payment-methods', async (req, res) => {
  const { country } = settings

  // Create a customer session to query enrollable payment methods
  const sessionRes = await fetch(`${API_URL}/v1/customers/sessions`, {
    method: 'POST',
    headers: {
      'public-api-key': PUBLIC_API_KEY,
      'private-secret-key': PRIVATE_SECRET_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account_id: ACCOUNT_CODE,
      country,
      customer_id: CUSTOMER_ID,
    }),
  }).then(r => r.json())

  if (!sessionRes.customer_session) {
    return res.status(500).json({ error: 'Failed to create customer session', detail: sessionRes })
  }

  const methodsRes = await fetch(
    `${API_URL}/v1/checkout/customers/sessions/${sessionRes.customer_session}/payment-methods`,
    {
      method: 'GET',
      headers: {
        'public-api-key': PUBLIC_API_KEY,
        'private-secret-key': PRIVATE_SECRET_KEY,
      },
    }
  ).then(r => r.json())

  res.json(methodsRes.payment_methods ?? [])
})

app.get('/checkout/payment-methods', async (req, res) => {
  const { country, amount: baseAmount, currency } = settings

  // Create a checkout session to query available payment methods
  const sessionRes = await fetch(`${API_URL}/v1/checkout/sessions`, {
    method: 'POST',
    headers: {
      'public-api-key': PUBLIC_API_KEY,
      'private-secret-key': PRIVATE_SECRET_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account_id: ACCOUNT_CODE,
      merchant_order_id: v4(),
      payment_description: 'HEG Demo Payment',
      country,
      customer_id: CUSTOMER_ID,
      amount: { currency, value: baseAmount },
    }),
  }).then(r => r.json())

  if (!sessionRes.checkout_session) {
    return res.status(500).json({ error: 'Failed to create checkout session', detail: sessionRes })
  }

  const methodsRes = await fetch(
    `${API_URL}/v1/checkout/sessions/${sessionRes.checkout_session}/payment-methods`,
    {
      method: 'GET',
      headers: {
        'public-api-key': PUBLIC_API_KEY,
        'private-secret-key': PRIVATE_SECRET_KEY,
      },
    }
  ).then(r => r.json())

  res.json(Array.isArray(methodsRes) ? methodsRes : (methodsRes.payment_methods ?? []))
})

app.post('/enrollment/method', (req, res) => {
  const { method } = req.body
  if (!method) return res.status(400).json({ error: 'method is required' })
  settings.enrollmentMethod = method
  res.json({ enrollmentMethod: settings.enrollmentMethod })
})

app.post('/customers/sessions', async (req, res) => {
  const { country } = settings

  const response = await fetch(
    `${API_URL}/v1/customers/sessions`,
    {
      method: 'POST',
      headers: {
        'public-api-key': PUBLIC_API_KEY,
        'private-secret-key': PRIVATE_SECRET_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_id: ACCOUNT_CODE,
        country,
        customer_id: CUSTOMER_ID,
      }),
    }
  ).then((resp) => resp.json())

  res.json(response)
})

app.post('/customers/sessions/:customerSession/payment-methods', async (req, res) => {
  const { customerSession } = req.params
  const { country } = settings

  const response = await fetch(
    `${API_URL}/v1/customers/sessions/${customerSession}/payment-methods`,
    {
      method: 'POST',
      headers: {
        'public-api-key': PUBLIC_API_KEY,
        'private-secret-key': PRIVATE_SECRET_KEY,
        'X-idempotency-key': v4(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payment_method_type: settings.enrollmentMethod ?? 'CARD',
        country,
        account_id: ACCOUNT_CODE,
      }),
    }
  ).then((resp) => resp.json())

  res.json(response)
})

app.listen(SERVER_PORT, async () => {
  console.log(`Server started at port: ${SERVER_PORT}`)
  console.log(`Demo available at: http://localhost:${SERVER_PORT}`)

  API_URL = generateBaseUrlApi()

  CUSTOMER_ID = await createCustomer().then(({ id }) => id)
  console.log(`Customer created: ${CUSTOMER_ID}`)

  await open(`http://localhost:${SERVER_PORT}`)
})

const ApiKeyPrefixToEnvironmentSuffix = {
  dev: '-dev',
  staging: '-staging',
  sandbox: '-sandbox',
  prod: '',
}

const baseAPIurl = 'https://api_ENVIRONMENT_.y.uno'

function generateBaseUrlApi() {
  const [apiKeyPrefix] = PUBLIC_API_KEY.split('_')
  const environmentSuffix = ApiKeyPrefixToEnvironmentSuffix[apiKeyPrefix]
  return baseAPIurl.replace('_ENVIRONMENT_', environmentSuffix)
}

function createCustomer() {
  return fetch(
    `${API_URL}/v1/customers`,
    {
      method: 'POST',
      headers: {
        'public-api-key': PUBLIC_API_KEY,
        'private-secret-key': PRIVATE_SECRET_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        country: 'CO',
        merchant_customer_id: Math.floor(Math.random() * 1000000).toString(),
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@y.uno',
      }),
    }
  ).then((resp) => resp.json())
}
