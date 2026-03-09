import { getPublicApiKey, getCustomerSession, createEnrollment } from './api.js'

async function initEnrollmentLite() {
  const { enrollmentMethod } = await fetch('/settings').then(r => r.json())
  const loader = document.getElementById('loader')

  document.getElementById('root').style.display = 'none'

  const { customer_session: customerSession, country: countryCode } = await getCustomerSession()
  await createEnrollment(customerSession)
  const publicApiKey = await getPublicApiKey()
  const yuno = await Yuno.initialize(publicApiKey)

  if (enrollmentMethod === 'PAYPAL_ENROLLMENT') {
    // ── PayPal: render enrollment button inline via element mode ──────────
    document.getElementById('external-enrollment').style.display = 'none'

    const paypalContainer = document.getElementById('paypal-btn')
    const observer = new MutationObserver(() => {
      if (paypalContainer.children.length > 0) {
        document.getElementById('external-enrollment').style.display = 'block'
        observer.disconnect()
      }
    })
    observer.observe(paypalContainer, { childList: true, subtree: true })

    yuno.mountEnrollmentLite({
      customerSession,
      countryCode,
      language: 'en',
      showLoading: true,
      renderMode: {
        type: 'element',
        elementSelector: {
          apmForm: '#paypal-btn',
          actionForm: '#action-form-element',
        },
      },
      yunoEnrollmentStatus: ({ status, vaultedToken }) => {
        console.log('enrollment status', { status, vaultedToken })
      },
      yunoError: (error) => {
        console.log('PayPal enrollment error', error)
        document.getElementById('external-enrollment').style.display = 'none'
      },
    })

  } else {
    // ── Card (or other): modal ────────────────────────────────────────────
    document.getElementById('external-enrollment').style.display = 'none'

    yuno.mountEnrollmentLite({
      customerSession,
      countryCode,
      language: 'en',
      showLoading: true,
      renderMode: {
        type: 'modal',
        elementSelector: {
          apmForm: '#form-element',
          actionForm: '#action-form-element',
        },
      },
      onLoading: () => { loader.style.display = 'none' },
      yunoEnrollmentStatus: ({ status, vaultedToken }) => {
        console.log('enrollment status', { status, vaultedToken })
        loader.style.display = 'none'
      },
      yunoError: (error) => {
        console.log('enrollment error', error)
        loader.style.display = 'none'
      },
    })
  }
}

window.addEventListener('yuno-sdk-ready', () => initEnrollmentLite())
