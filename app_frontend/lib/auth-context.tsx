"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createSupabaseClient } from './supabase-browser'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

// Define the auth context state type
type AuthContextType = {
  user: any
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

// Create context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
})

// Hook to use the auth context
export const useAuth = () => useContext(AuthContext)

/**
 * Opens a popup window centered on the screen for authentication
 * This is used to maintain app state during the authentication process
 * 
 * @param url The URL to open in the popup
 * @param title The window title (not visible to user)
 * @param width The width of the popup window
 * @param height The height of the popup window
 * @returns The popup window reference
 */
const openPopupWindow = (url: string, title: string, width: number, height: number) => {
  const left = window.screenX + (window.outerWidth - width) / 2
  const top = window.screenY + (window.outerHeight - height) / 2
  
  return window.open(
    url,
    title,
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
  )
}

/**
 * AuthProvider component that manages authentication state
 * Uses a popup-based authentication flow to preserve the main window's state
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createSupabaseClient()
  const router = useRouter()
  const { toast } = useToast()

  // Initialize auth state
  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
      setLoading(false)
      
      // Set up auth state listener
      const { data: { subscription } } = await supabase.auth.onAuthStateChange(
        (event, session) => {
          setUser(session?.user || null)
          router.refresh()
        }
      )
      
      return () => {
        subscription.unsubscribe()
      }
    }
    
    loadUser()
  }, [supabase, router])

  /**
   * Initiates Google sign-in using a popup window
   * This method preserves the main window's state (like selected files)
   * by using a popup for authentication instead of a full-page redirect
   */
  const signIn = async () => {
    try {
      // Create a popup window with Google OAuth
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/popup-callback`,
          skipBrowserRedirect: true, // Prevents the main window from redirecting
        }
      })
      
      if (error) {
        throw error
      }
      
      if (data?.url) {
        // Open the authentication URL in a popup
        const authWindow = openPopupWindow(data.url, 'Sign in with Google', 580, 600)
        
        // Poll for popup window closing
        const pollTimer = setInterval(() => {
          if (!authWindow || authWindow.closed) {
            clearInterval(pollTimer)
            
            // When the popup closes:
            // 1. The popup has already exchanged the auth code for a session
            // 2. Our onAuthStateChange listener above will detect the new session
            // 3. The user state will update automatically
          }
        }, 500)
      }
    } catch (error: any) {
      toast({
        title: "Authentication error",
        description: error.message || "Failed to sign in",
        variant: "destructive"
      })
    }
  }

  // Handle sign out
  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/')
      toast({
        title: "Signed out",
        description: "You have been successfully signed out."
      })
    } catch (error: any) {
      toast({
        title: "Error signing out",
        description: error.message || "Failed to sign out",
        variant: "destructive"
      })
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
} 