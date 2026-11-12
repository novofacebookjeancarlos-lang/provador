export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateProductionGuard } = await import('./lib/generation-guard.js')
    validateProductionGuard()
  }
}
