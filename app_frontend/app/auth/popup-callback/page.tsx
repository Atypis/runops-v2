'use client'

import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase-browser'

/**
 * Popup Callback Page
 * 
 * This page handles both OAuth redirects and email verification when using popup authentication.
 * When Google authentication or email verification completes, it redirects to this page.
 * This page then:
 * 1. Extracts the auth code or email token from the URL
 * 2. Exchanges it for a session
 * 3. Closes the popup window
 * 
 * This approach allows the main window to maintain its state (like file selections)
 * while the authentication happens in a separate window.
 */
export default function PopupCallback() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function handleAuth() {
      // Check for hash-based auth (used by email verification)
      if (window.location.hash) {
        await handleEmailVerification()
        return
      }
      
      // Check for code-based auth (used by OAuth)
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const type = params.get('type')
      
      if (code) {
        await handleOAuthCallback(code)
      } else if (type && type === 'email') {
        // Email verification flow without code (post-verification redirect)
        // We can just check if there's a session already
        await checkExistingSession()
      } else {
        // No valid auth parameters found, close the window after a delay
        setStatus('error')
        setErrorMessage('No authentication parameters found')
        setTimeout(() => {
          window.close()
        }, 3000)
      }
    }

    handleAuth().catch(error => {
      console.error('Failed to handle authentication:', error)
      setStatus('error')
      setErrorMessage(error.message || 'Authentication failed')
      setTimeout(() => {
        window.close()
      }, 3000)
    })
  }, [])

  /**
   * Handles the OAuth callback by exchanging the code for a session
   * and then closing the popup window
   */
  const handleOAuthCallback = async (code: string) => {
    try {
      const supabase = createSupabaseClient()
      // Exchange the code for a session
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Error exchanging code for session:', error)
        
        // If the error is about code verifier, check if we already have a session
        if (error.message?.includes('code verifier')) {
          await checkExistingSession()
          return
        }
        
        setStatus('error')
        setErrorMessage(error.message)
        return
      }
      
      setStatus('success')
      
      // Close the popup window after authentication with a slight delay
      // to ensure the user sees the success message
      setTimeout(() => {
        window.close()
      }, 1500)
    } catch (error: any) {
      console.error('Failed to handle OAuth callback:', error)
      
      // Try to check for an existing session as a fallback
      await checkExistingSession()
    }
  }

  /**
   * Handles email verification by confirming the email token
   */
  const handleEmailVerification = async () => {
    try {
      const supabase = createSupabaseClient()
      
      // Check if we have hash parameters (email verification links use hash fragment)
      if (window.location.hash) {
        // Just get the current session - Supabase should handle the hash automatically
        await checkExistingSession()
        return
      }
      
      // Get URL params for other email flows
      const params = Object.fromEntries(
        new URLSearchParams(window.location.search).entries()
      )
      
      // If there are query parameters but no session was established
      if (Object.keys(params).length > 0) {
        setStatus('error')
        setErrorMessage('Could not complete email verification. Please try signing in again.')
      }
      
      // Close the popup window after a delay
      setTimeout(() => {
        window.close()
      }, 3000)
    } catch (error: any) {
      console.error('Failed to handle email verification:', error)
      setStatus('error')
      setErrorMessage(error.message || 'Failed to verify email')
      
      // Close the popup after a delay even if there was an error
      setTimeout(() => {
        window.close()
      }, 3000)
    }
  }
  
  /**
   * Checks if there's already an existing session
   * This is useful for when the code exchange failed but the user is already authenticated
   */
  const checkExistingSession = async () => {
    try {
      const supabase = createSupabaseClient()
      const { data, error } = await supabase.auth.getSession()
      
      if (error) {
        throw error
      }
      
      if (data.session) {
        // We already have a valid session
        setStatus('success')
        setTimeout(() => {
          window.close()
        }, 1500)
        return true
      }
      
      // No valid session
      setStatus('error')
      setErrorMessage('No active session found. Please try signing in again.')
      setTimeout(() => {
        window.close()
      }, 3000)
      return false
    } catch (error: any) {
      console.error('Error checking session:', error)
      setStatus('error')
      setErrorMessage(error.message || 'Failed to verify session')
      setTimeout(() => {
        window.close()
      }, 3000)
      return false
    }
  }
  
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="text-center max-w-md">
        {status === 'processing' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
            </div>
            <h2 className="text-xl font-medium mb-2">Processing authentication...</h2>
            <p className="text-gray-500">Please wait while we complete your sign-in.</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="flex justify-center mb-4 text-green-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <h2 className="text-xl font-medium mb-2">Authentication successful</h2>
            <p className="text-gray-500">You can close this window and continue.</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="flex justify-center mb-4 text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </div>
            <h2 className="text-xl font-medium mb-2">Authentication error</h2>
            <p className="text-red-500 mb-2">{errorMessage}</p>
            <p className="text-gray-500">This window will close automatically.</p>
          </>
        )}
      </div>
    </div>
  )
} 