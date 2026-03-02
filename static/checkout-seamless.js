import { getCheckoutSession, createPayment, getPublicApiKey, updateSessionFee } from "./api.js"

async function initSeamlessCheckout() {
  let sessionData = await getCheckoutSession()
  let checkoutSession = sessionData.checkout_session
  const countryCode = sessionData.country
  const baseAmount = sessionData.amount?.value ?? 2000
  const currency = sessionData.amount?.currency ?? 'COP'

  const publicApiKey = await getPublicApiKey()
  const yuno = await Yuno.initialize(publicApiKey)

  const loader = document.getElementById('loader')
  const surchargeNotice = document.getElementById('surcharge-notice')
  const surchargeConfirm = document.getElementById('surcharge-confirm')
  let isPaying = false
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

    onLoading: () => {
      if (!isPaying) {
        loader.style.display = 'none'
      }
    },

    yunoPaymentMethodSelected(data) {
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
        checkoutSession = newSessionData.checkout_session
        yuno.updateCheckoutSession(newSessionData.checkout_session)
        yuno.mountCheckout({ paymentMethodType: 'CARD' })
        return
      }

      if (result === 'change-method') {
        isPaying = false
        window.location.href = '/checkout'
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

  yuno.mountCheckout({ paymentMethodType: 'CARD' })

  const payButton = document.getElementById('button-pay')
  payButton.addEventListener('click', () => {
    yuno.startPayment()
  })
}

window.addEventListener('yuno-sdk-ready', initSeamlessCheckout)
