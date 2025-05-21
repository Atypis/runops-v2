"use client"

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth-context'
import { useEffect } from 'react'

/**
 * Authentication Modal Component
 * 
 * This modal provides the UI for initiating the authentication process.
 * It works with the popup authentication flow to preserve the main application state:
 * 
 * 1. User clicks "Sign in with Google" in this modal
 * 2. Auth context opens a popup window for authentication
 * 3. When auth completes in the popup, this modal automatically closes
 * 4. The app continues with the authenticated user without losing state
 */
interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const { signIn, user } = useAuth()

  const handleSignIn = async () => {
    await signIn()
    // We don't need to manually close the modal here as it will
    // close automatically when the user is authenticated via the useEffect
  }

  // Close the dialog automatically when the user authenticates
  useEffect(() => {
    if (user && open) {
      onOpenChange(false)
    }
  }, [user, open, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 bg-white border-none">
        <DialogHeader className="space-y-2 pb-2">
          <DialogTitle className="text-center text-xl font-semibold">Continue with Runops</DialogTitle>
          <DialogDescription className="text-center text-gray-500">
            To generate a SOP, create a Runops account or log into an existing one.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-6">
          <div className="mx-auto flex items-center justify-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-black">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
          </div>
          <Button 
            onClick={handleSignIn} 
            className="w-full bg-black hover:bg-gray-800 text-white py-5 h-auto font-medium text-base rounded-md"
          >
            Sign in with Google
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)} 
            className="w-full border-gray-300 hover:bg-gray-50 text-gray-700 h-auto py-5 font-medium text-base rounded-md"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
} 