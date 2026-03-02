import { getCheckoutSession, createPayment, getPublicApiKey } from "./api.js"

async function initCheckout() {
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
      const cancelBtn = document.getElementById('sc-cancel')
      const okBtn = document.getElementById('sc-ok')

      function onCancel() {
        cleanup()
        resolve(false)
      }

      function onConfirm() {
        cleanup()
        resolve(true)
      }

      function cleanup() {
        surchargeConfirm.style.display = 'none'
        cancelBtn.removeEventListener('click', onCancel)
        okBtn.removeEventListener('click', onConfirm)
      }

      cancelBtn.addEventListener('click', onCancel)
      okBtn.addEventListener('click', onConfirm)
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
      } else {
        surchargeNotice.style.display = 'none'
      }
    },

    async yunoCreatePayment(oneTimeToken, tokenWithInfo) {
      console.log('tokenWithInformation', tokenWithInfo)

      isPaying = true
      yuno.hideLoader()

      const cardCountryCode = tokenWithInfo?.card_data?.country_code ?? null
      const cardCountryName = tokenWithInfo?.card_data?.country_name ?? null
      const rateMayVary = !cardCountryCode

      const surchargeRate = selectedPaymentMethod === 'CARD'
        ? (cardCountryCode === 'SG' ? 0.01 : 0.02)
        : 0
      const surchargeAmount = Math.round(baseAmount * surchargeRate)
      const totalAmount = baseAmount + surchargeAmount

      const confirmed = await showSurchargeConfirm({
        cardCountryCode,
        cardCountryName,
        surchargeRate,
        surchargeAmount,
        totalAmount,
        rateMayVary,
      })

      if (!confirmed) {
        isPaying = false
        yuno.startPayment()
        return
      }

      loader.style.display = 'block'
      await createPayment({ oneTimeToken, checkoutSession, surchargeRate })
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

window.addEventListener('yuno-sdk-ready', initCheckout)
