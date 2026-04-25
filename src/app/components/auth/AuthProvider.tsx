'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '../../../../utils/supabase/client'
import type { SupabaseClient, Session } from '@supabase/supabase-js'

type SupabaseContextType = {
  supabase: SupabaseClient
  session: Session | null
}

const SupabaseContext = createContext<SupabaseContextType | null>(null)

export default function SupabaseProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    // Inicializa a sessão para UI do cliente (ok no browser)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Escuta mudanças de auth e mantém o estado em sincronia
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_OUT') {
        try {
          import('idb-keyval').then(({ clear }) => clear().catch(() => {}))
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('gpl_api_check_state_v1')
          }
        } catch (e) {
          console.error('Failed to clear client caches on sign out', e)
        }
      }
      setSession(session)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  return (
    <SupabaseContext.Provider value={{ supabase, session }}>
      {children}
    </SupabaseContext.Provider>
  )
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext)
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider')
  }
  return context
}
