"use client"

import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Sparkles,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuth } from '@/lib/auth-context'
import { useState } from 'react'
import { AuthModal } from '@/components/ui/auth-modal'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function NavUser() {
  const { isMobile } = useSidebar()
  const { user, loading, signOut } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)

  // Get user initials for avatar fallback
  const getUserInitials = (user: any): string => {
    if (!user || !user.email) return '?'
    
    const parts = user.email.split('@')[0].split(/[.-_]/)
    return parts.slice(0, 2).map((part: string) => part[0]?.toUpperCase()).join('')
  }

  // Show loading state
  if (loading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg">
            <div className="h-8 w-8 rounded-lg bg-gray-200 animate-pulse"></div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded animate-pulse mt-1"></div>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  // Show login button if not authenticated
  if (!user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" onClick={() => setShowAuthModal(true)}>
            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
              ?
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">Sign in</span>
              <span className="truncate text-xs">Get started with RunOps</span>
            </div>
          </SidebarMenuButton>
          <AuthModal 
            open={showAuthModal} 
            onOpenChange={setShowAuthModal} 
            context="navbar" 
          />
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  // Show user dropdown if authenticated
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.user_metadata?.avatar_url} alt={user.email} />
                <AvatarFallback className="rounded-lg">{getUserInitials(user)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
                </span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.user_metadata?.avatar_url} alt={user.email} />
                  <AvatarFallback className="rounded-lg">{getUserInitials(user)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
                  </span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/my-sops" className="w-full">
                  <BadgeCheck />
                  My SOPs
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCard />
                Account Settings
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell />
                Preferences
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
