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
import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * Authentication Modal Component
 * 
 * This modal provides the UI for initiating the authentication process.
 * It supports both Google OAuth and Email/Password authentication.
 * It works with the popup authentication flow to preserve the main application state.
 */
interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  context?: 'navbar' | 'upload'
}

export function AuthModal({ open, onOpenChange, context = 'upload' }: AuthModalProps) {
  const { signIn, signInWithEmail, signUpWithEmail, user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [verificationSent, setVerificationSent] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')

  const handleGoogleSignIn = async () => {
    await signIn()
    // We don't need to manually close the modal here as it will
    // close automatically when the user is authenticated via the useEffect
  }

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (authMode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      if (authMode === 'signin') {
        await signInWithEmail(email, password)
      } else {
        const result = await signUpWithEmail(email, password)
        if (result.success) {
          // Save the email for the verification message
          setVerificationEmail(email)
          setVerificationSent(true)
        } else if (result.error) {
          setError(result.error)
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Reset states when modal closes
  useEffect(() => {
    if (!open) {
      setVerificationSent(false)
      setError('')
      if (!user) {
        setEmail('')
        setPassword('')
        setConfirmPassword('')
      }
    }
  }, [open, user])

  // Close the dialog automatically when the user authenticates
  useEffect(() => {
    if (user && open) {
      onOpenChange(false)
    }
  }, [user, open, onOpenChange])

  // Show verification instructions if signup was successful
  if (verificationSent) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md p-6 bg-white border-none">
          <DialogHeader className="space-y-2 pb-2">
            <DialogTitle className="text-center text-xl font-semibold">Check your email</DialogTitle>
            <DialogDescription className="text-center text-gray-500">
              A verification link has been sent to <span className="font-medium">{verificationEmail}</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 py-6">
            <div className="mx-auto flex items-center justify-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-blue-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </div>
            </div>
            <div className="text-center text-sm text-gray-500 space-y-4">
              <p>
                Please check your email and click the verification link to complete your signup.
              </p>
              <p>
                After verifying, you can close this dialog and sign in with your email and password.
              </p>
            </div>
            
            <div className="space-y-2">
              <Button
                onClick={() => {
                  setVerificationSent(false)
                  setAuthMode('signin')
                }}
                className="w-full bg-black hover:bg-gray-800 text-white py-5 h-auto font-medium text-base rounded-md"
              >
                Back to Sign In
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full border-gray-300 hover:bg-gray-50 text-gray-700 h-auto py-5 font-medium text-base rounded-md"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 bg-white border-none">
        <DialogHeader className="space-y-2 pb-2">
          <DialogTitle className="text-center text-xl font-semibold">Continue with Runops</DialogTitle>
          {context === 'upload' ? (
            <DialogDescription className="text-center text-gray-500">
              To generate a SOP, create a Runops account or log into an existing one.
            </DialogDescription>
          ) : (
            <DialogDescription className="text-center text-gray-500">
              Sign in to your account to access all features.
            </DialogDescription>
          )}
        </DialogHeader>
        
        <Tabs defaultValue="google" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="google">Google</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
          </TabsList>
          
          <TabsContent value="google" className="flex flex-col gap-4 py-2">
            <div className="mx-auto flex items-center justify-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-black">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
            </div>
            <Button 
              onClick={handleGoogleSignIn} 
              className="w-full bg-black hover:bg-gray-800 text-white py-5 h-auto font-medium text-base rounded-md"
            >
              Sign in with Google
            </Button>
          </TabsContent>
          
          <TabsContent value="email">
            <div className="flex justify-center space-x-4 mb-4">
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "flex-1 py-2",
                  authMode === 'signin' ? "border-b-2 border-black" : ""
                )}
                onClick={() => setAuthMode('signin')}
              >
                Sign In
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "flex-1 py-2",
                  authMode === 'signup' ? "border-b-2 border-black" : ""
                )}
                onClick={() => setAuthMode('signup')}
              >
                Sign Up
              </Button>
            </div>
            
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email"
                  type="email" 
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  placeholder="name@example.com" 
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password"
                  type="password" 
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  required
                />
              </div>
              
              {authMode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input 
                    id="confirm-password"
                    type="password" 
                    value={confirmPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••" 
                    required
                  />
                </div>
              )}
              
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
              
              <Button 
                type="submit"
                disabled={loading}
                className="w-full bg-black hover:bg-gray-800 text-white py-5 h-auto font-medium text-base rounded-md"
              >
                {loading ? 'Please wait...' : authMode === 'signin' ? 'Sign In' : 'Sign Up'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
        
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)} 
          className="w-full border-gray-300 hover:bg-gray-50 text-gray-700 h-auto py-5 font-medium text-base rounded-md mt-4"
        >
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  )
} 