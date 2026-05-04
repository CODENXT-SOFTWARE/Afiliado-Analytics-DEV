// app/track_vendors/yvi/layout.tsx
//
// Layout dedicado pra "home da Yvi" — visualmente idêntico ao layout
// principal (`src/app/(main)/layout.tsx`): mesmo Header, Footer,
// LoginModalProvider e prompt de push.
//
// Como esta pasta está FORA do grupo `(main)` no roteamento, ela não
// herda aquele layout — por isso replicamos os mesmos componentes aqui,
// reutilizando os arquivos originais (não duplicados). Editar Header /
// Footer no app continua refletindo aqui também.
//
// Os componentes visuais da home (Faq, Pricing, etc.) são cópias
// editáveis em `./components/` — esses sim ficam isolados.
'use client'

import { Header } from '@/app/components/layout/Header'
import { Footer } from '@/app/components/layout/Footer'
import {
  LoginModalProvider,
  useLoginModal,
} from '@/app/components/auth/LoginModalProvider'
import PushPermissionPrompt from '@/app/components/PushPermissionPrompt'

function VendorChrome({ children }: { children: React.ReactNode }) {
  const { openLogin } = useLoginModal()
  return (
    <div className="flex min-h-screen flex-col">
      <Header onLoginClick={openLogin} />
      <main className="flex-grow">{children}</main>
      <Footer />
      <PushPermissionPrompt />
    </div>
  )
}

export default function YviLayout({ children }: { children: React.ReactNode }) {
  return (
    <LoginModalProvider>
      <VendorChrome>{children}</VendorChrome>
    </LoginModalProvider>
  )
}
