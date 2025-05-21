'use client'

import { useEffect } from 'react'
import { createSupabaseClient } from '@/lib/supabase-browser'

export default function PopupCallback() {
  useEffect(() => {
    // Get the auth code from the URL
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    
    if (code) {
      handleCallback(code)
    } else {
      // No code found, close the window
      window.close()
    }
  }, [])
  
  // Handle the OAuth callback
  const handleCallback = async (code: string) => {
    try {
      const supabase = createSupabaseClient()
      // Exchange the code for a session
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Error exchanging code for session:', error)
      }
      
      // Close the popup window after authentication
      window.close()
    } catch (error) {
      console.error('Failed to handle auth callback:', error)
      window.close()
    }
  }
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-medium mb-2">Authentication successful</h2>
        <p className="text-gray-500">You can close this window and continue.</p>
      </div>
    </div>
  )
} 