"use client"

import Link from 'next/link'
import { Button } from './button'
import { Avatar, AvatarFallback, AvatarImage } from './avatar'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from './dropdown-menu'
import { useCallback, useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

export function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createSupabaseClient()
  const router = useRouter()
  const { toast } = useToast()

  // Get user on initial load
  useEffect(() => {
    async function getUser() {
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
    
    getUser()
  }, [supabase, router])

  // Handle sign in with Google
  const handleSignIn = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })
      
      if (error) {
        throw error
      }
    } catch (error: any) {
      toast({
        title: "Authentication error",
        description: error.message || "Failed to sign in",
        variant: "destructive"
      })
    }
  }, [supabase, toast])

  // Handle sign out
  const handleSignOut = useCallback(async () => {
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
  }, [supabase, router, toast])

  // Get user initials for avatar fallback
  const getUserInitials = (user: any): string => {
    if (!user || !user.email) return '?'
    
    const parts = user.email.split('@')[0].split(/[.-_]/)
    return parts.slice(0, 2).map((part: string) => part[0]?.toUpperCase()).join('')
  }

  return (
    <nav className="border-b border-gray-200 py-3">
      <div className="container flex justify-between items-center">
        <Link href="/" className="text-xl font-semibold">
          Runops
        </Link>
        
        <div>
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
          ) : !user ? (
            <Button variant="outline" onClick={handleSignIn}>
              Sign in with Google
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="cursor-pointer">
                  <AvatarImage src={user.user_metadata?.avatar_url} />
                  <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/my-sops" className="w-full">My SOPs</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </nav>
  )
} 