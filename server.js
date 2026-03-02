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

const staticDirectory = path.join(__dirname, 'static')
const checkoutPage = path.join(__dirname, 'pages/checkout.html')

const app = express()

app.use(express.json())
app.use('/static', express.static(staticDirectory))

app.get('/', (req, res) => {
  res.redirect('/checkout')
})

app.get('/checkout', (req, res) => {
  res.sendFile(checkoutPage)
})

app.get('/public-api-key', (req, res) => {
  res.json({ publicApiKey: PUBLIC_API_KEY })
})

app.post('/checkout/sessions', async (req, res) => {
  const country = req.query.country || 'CO'
  const { currency } = getCountryData(country)

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
          value: 2000,
        },
      }),
    }
  ).then((resp) => resp.json())

  res.send(response)
})

app.post('/payments', async (req, res) => {
  const { checkoutSession, oneTimeToken, surchargeRate } = req.body
  const country = req.query.country || 'CO'
  const { currency, documentNumber, documentType, amount } = getCountryData(country)

  const baseAmount = amount
  const surcharge = surchargeRate ? Math.round(baseAmount * surchargeRate) : 0
  const totalAmount = baseAmount + surcharge

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

app.listen(SERVER_PORT, async () => {
  console.log(`Server started at port: ${SERVER_PORT}`)
  console.log(`Demo available at: http://localhost:${SERVER_PORT}/checkout`)

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
