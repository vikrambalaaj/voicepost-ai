/**
 * The shared "Try Demo" account. Enabled by default; set DEMO_LOGIN_ENABLED=false
 * to turn it off. It never carries admin rights and never replaces a real session.
 */
export function isDemoLoginEnabled(): boolean {
  return process.env.DEMO_LOGIN_ENABLED !== "false";
}
