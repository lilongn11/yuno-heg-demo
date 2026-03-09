import { getCheckoutSession, createPayment, getPublicApiKey, updateSessionFee, getSeamlessCheckoutSession } from "./api.js"

async function initExternalCheckout(onFallback) {
  const { checkout_session: checkoutSession, country: countryCode } = await getSeamlessCheckoutSession()
  const publicApiKey = await getPublicApiKey()
  const yuno = await Yuno.initialize(publicApiKey)

  await yuno.startSeamlessCheckout({
    checkoutSession,
    elementSelector: '#root',
    countryCode,
    language: 'en',
    renderMode: {
      type: 'element',
      elementSelector: '#form-element',
    },
    yunoPaymentResult(data) { console.log('yunoPaymentResult', data) },
    yunoError: (error) => {
      console.log('No external payment methods available, continuing with regular checkout', error)
      document.getElementById('external-buttons').style.display = 'none'
      onFallback()
    },
  })

  // External buttons only — no card form in this mode
  document.getElementById('button-pay').style.display = 'none'
  document.getElementById('external-buttons').style.display = 'block'
  document.querySelectorAll('.external-btn-row').forEach(row => row.style.display = 'none')
  ;['paypal-btn', 'google-pay-btn', 'apple-pay-btn'].forEach(id => {
    const container = document.getElementById(id)
    const observer = new MutationObserver(() => {
      if (container.children.length > 0) {
        container.closest('.external-btn-row').style.display = 'flex'
        observer.disconnect()
      }
    })
    observer.observe(container, { childList: true, subtree: true })
  })
  yuno.mountSeamlessExternalButtons([
    { paymentMethodType: 'PAYPAL_ENROLLMENT', elementSelector: '#paypal-btn' },
    { paymentMethodType: 'GOOGLE_PAY', elementSelector: '#google-pay-btn' },
    { paymentMethodType: 'APPLE_PAY',  elementSelector: '#apple-pay-btn' },
  ])
}

async function initCheckout(forceRegular = false) {
  const isExternal = !forceRegular && new URLSearchParams(window.location.search).get('external') === 'true'
  console.log('[checkout] isExternal:', isExternal, '| URL:', window.location.search)
  if (isExternal) return initExternalCheckout(() => initCheckout(true))
  const sessionData = await getCheckoutSession()
  const { checkout_session: checkoutSession, country: countryCode } = sessionData
  const baseAmount = sessionData.amount?.value ?? 2000
  const currency = sessionData.amount?.currency ?? 'COP'

  const publicApiKey = await getPublicApiKey()
  const yuno = await Yuno.initialize(publicApiKey)

  const loader = document.getElementById('loader')
  const surchargeNotice = document.getElementById('surcharge-notice')
  const surchargeConfirm = document.getElementById('surcharge-confirm')
  let isPaying = false
  let selectedPaymentMethod = null
  let pendingCardOpen = false

  function formatAmount(amount) {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  function showSurchargeConfirm(data) {
    const { cardCountryCode, cardCountryName, surchargeRate, surchargeAmount, totalAmount, rateMayVary } = data

    document.getElementById('sc-country').textContent = cardCountryName || cardCountryCode || 'Unknown'
    document.getElementById('sc-rate').textContent = `${(surchargeRate * 100).toFixed(0)}%`
    document.getElementById('sc-base').textContent = formatAmount(baseAmount)
    document.getElementById('sc-fee').textContent = formatAmount(surchargeAmount)
    document.getElementById('sc-total').textContent = formatAmount(totalAmount)

    const disclaimer = document.getElementById('sc-disclaimer')
    disclaimer.style.display = rateMayVary ? 'block' : 'none'

    surchargeConfirm.style.display = 'flex'

    return new Promise((resolve) => {
      const backCardBtn = document.getElementById('sc-back-card')
      const okBtn = document.getElementById('sc-ok')
      const changeMethodBtn = document.getElementById('sc-change-method')

      function onBackCard() { cleanup(); resolve('different-card') }
      function onConfirm() { cleanup(); resolve('confirm') }
      function onChangeMethod() { cleanup(); resolve('change-method') }

      function cleanup() {
        surchargeConfirm.style.display = 'none'
        backCardBtn.removeEventListener('click', onBackCard)
        okBtn.removeEventListener('click', onConfirm)
        changeMethodBtn.removeEventListener('click', onChangeMethod)
      }

      backCardBtn.addEventListener('click', onBackCard)
      okBtn.addEventListener('click', onConfirm)
      changeMethodBtn.addEventListener('click', onChangeMethod)
    })
  }

  await yuno.startCheckout({
    checkoutSession,
    elementSelector: '#root',
    countryCode,
    language: 'en',
    showLoading: true,
    keepLoader: true,

    onLoading: (args) => {
      if (!isPaying) {
        loader.style.display = 'none'
      }
    },

    renderMode: {
      type: 'modal',
      elementSelector: {
        apmForm: '#form-element',
        actionForm: '#action-form-element',
      },
    },

    card: {
      type: 'extends',
      styles: '',
    },

    yunoPaymentMethodSelected(data) {
      console.log('onPaymentMethodSelected', data)
      selectedPaymentMethod = data.type

      if (data.type === 'CARD') {
        surchargeNotice.style.display = 'block'
        if (pendingCardOpen) {
          pendingCardOpen = false
          setTimeout(() => yuno.startPayment(), 500)
        }
      } else {
        surchargeNotice.style.display = 'none'
      }
    },

    async yunoCreatePayment(oneTimeToken, tokenWithInfo) {
      console.log('tokenWithInformation', tokenWithInfo)

      isPaying = true
      yuno.hideLoader()

      const feeData = await updateSessionFee({ checkoutSession, tokenWithInfo })

      const result = await showSurchargeConfirm({
        cardCountryCode: tokenWithInfo?.card_data?.country_code ?? null,
        cardCountryName: tokenWithInfo?.card_data?.country_name ?? null,
        surchargeRate: feeData.surchargeRate,
        surchargeAmount: feeData.surchargeAmount,
        totalAmount: feeData.totalAmount,
        rateMayVary: !tokenWithInfo?.card_data?.country_code,
      })

      if (result === 'different-card') {
        isPaying = false
        pendingCardOpen = true
        const newSessionData = await getCheckoutSession()
        yuno.updateCheckoutSession(newSessionData.checkout_session)
        yuno.mountCheckout({ paymentMethodType: 'CARD' })
        return
      }

      if (result === 'change-method') {
        isPaying = false
        selectedPaymentMethod = null
        surchargeNotice.style.display = 'none'
        const newSessionData = await getCheckoutSession()
        yuno.updateCheckoutSession(newSessionData.checkout_session)
        yuno.mountCheckout()
        return
      }

      // result === 'confirm'
      loader.style.display = 'block'
      await createPayment({ oneTimeToken, checkoutSession })
      yuno.continuePayment()
    },

    yunoPaymentResult(data) {
      console.log('yunoPaymentResult', data)
      yuno.hideLoader()
    },

    yunoError: (error) => {
      console.log('There was an error', error)
      yuno.hideLoader()
    },
  })

  yuno.mountCheckout()

  const payButton = document.getElementById('button-pay')
  payButton.addEventListener('click', () => {
    yuno.startPayment()
  })
}

window.addEventListener('yuno-sdk-ready', () => initCheckout())
