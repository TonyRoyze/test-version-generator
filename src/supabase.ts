import { createClient } from '@supabase/supabase-js'

const callback = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.hash.slice(1))
export const initialAuthAction = callback.get('type')
export const authCallbackError = callback.get('error_description')

const url = import.meta.env?.VITE_SUPABASE_URL
const publishableKey = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY

/** A browser-safe Supabase client. Never put a secret/service-role key here. */
export const supabase = url && publishableKey
  ? createClient(url, publishableKey)
  : null

export const isSupabaseConfigured = supabase !== null
