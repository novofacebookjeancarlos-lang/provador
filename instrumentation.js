export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateProductionGuard } = await import('./lib/generation-guard.js')
    try {
      validateProductionGuard()
    } catch (error) {
      console.error(error.message)
      process.exit(1)
    }
  }
}
