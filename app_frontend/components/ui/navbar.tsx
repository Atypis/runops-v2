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
import { useAuth } from '@/lib/auth-context'

export function Navbar() {
  const { user, loading, signIn, signOut } = useAuth()

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
            <Button variant="outline" onClick={signIn}>
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
                <DropdownMenuItem onClick={signOut}>
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