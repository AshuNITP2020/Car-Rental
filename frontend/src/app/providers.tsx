import { useEffect, type ReactNode } from 'react'
import { Provider } from 'react-redux'
import { ToastProvider } from '../components/ui/toast'
import { bootstrapSession } from '../features/auth/auth-slice'
import { tokenStore } from '../lib/token-store'
import { useAppDispatch } from './hooks'
import { store } from './store'
import { ThemeProvider } from './theme'

/** On app start, resolve /me from any stored tokens so a page refresh keeps
 *  the session (status stays 'loading' until this settles). */
function AuthBootstrap({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch()
  useEffect(() => {
    if (tokenStore.get()) void dispatch(bootstrapSession())
  }, [dispatch])
  return children
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <Provider store={store}>
        <ToastProvider>
          <AuthBootstrap>{children}</AuthBootstrap>
        </ToastProvider>
      </Provider>
    </ThemeProvider>
  )
}
