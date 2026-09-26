import { LoginPage } from './account-settings'
import { LandingPage } from './landing-page'
import { AboutPage, PrivacyPage } from './site-pages'
import { useRoute } from './use-route'

/** Public pages never open the signed-in user's authoring databases. */
export function SignedOutApp() {
  const route = useRoute()
  if (route === '/' || route === '/welcome') return <LandingPage returning={false} />
  if (route === '/about') return <AboutPage persistentStorage="unavailable" />
  if (route === '/privacy') return <PrivacyPage persistentStorage="unavailable" />
  return <LoginPage />
}
