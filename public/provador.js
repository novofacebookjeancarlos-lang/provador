(() => {
  const script = document.currentScript
  const root = document.getElementById(script?.dataset.target || 'provador-vitrine')
  const store = script?.dataset.loja
  const origin = script?.src && new URL(script.src).origin
  if (!root || !store || !origin || root.dataset.mounted) return
  root.dataset.mounted = 'true'

  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'Experimentar em mim'
  button.className = 'provador-vitrine-button'
  root.append(button)

  const status = document.createElement('span')
  status.setAttribute('role', 'status')
  root.append(status)

  function selectedVariant() {
    if (root.dataset.variante) return root.dataset.variante
    const form = root.closest('form') || document.querySelector('form[action*="/cart/add"]')
    return form?.querySelector('[name="id"]')?.value ||
      new URL(location.href).searchParams.get('variant') || script.dataset.variante
  }

  button.addEventListener('click', async () => {
    const variant = selectedVariant()
    if (!variant) {
      status.textContent = ' Escolha uma variante.'
      return
    }
    button.disabled = true
    status.textContent = ' Abrindo provador…'
    try {
      const query = new URLSearchParams({ loja: store, variante: variant })
      const response = await fetch(origin + '/api/vitrine?' + query)
      if (response.status === 404) {
        status.textContent = ' Provador indisponível para esta variante.'
        return
      }
      if (!response.ok) throw new Error('Vitrine indisponível')
      const { path } = await response.json()
      const destination = new URL(path, origin)
      if (destination.origin !== origin) throw new Error('Endereço inválido')
      location.assign(destination.href)
    } catch {
      status.textContent = ' Tente novamente em instantes.'
    } finally {
      button.disabled = false
    }
  })
})()
