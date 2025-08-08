# Popup Authentication Flow

This document explains how the popup-based authentication flow works in the Runops application, specifically how it helps preserve user state during authentication.

## Overview

The Runops application implements a popup-based authentication flow using Supabase Auth. This approach allows users to authenticate without losing their current state in the main application window (such as uploaded files waiting to be processed).

## Key Components

The authentication flow consists of three main components:

1. **Auth Context (`lib/auth-context.tsx`)**
   - Manages authentication state
   - Implements popup-based sign-in
   - Tracks user session

2. **Auth Modal (`components/ui/auth-modal.tsx`)**
   - Provides UI for initiating authentication
   - Automatically closes when authentication is complete

3. **Popup Callback (`app/auth/popup-callback/page.tsx`)**
   - Handles OAuth redirects
   - Exchanges authentication code for a session
   - Closes the popup window

## How It Works

### Authentication Flow

1. **User selects a file and clicks "Create SOP"**
   - If the user is not authenticated, the auth modal appears

2. **User clicks "Sign in with Google" in the modal**
   - The `signIn` function in the auth context is called
   - Supabase Auth is configured with `skipBrowserRedirect: true`
   - An authentication URL is generated but not automatically opened

3. **Popup window opens with Google authentication**
   - A centered popup window is created with the auth URL
   - The main window remains unchanged and maintains its state
   - The main window polls for the popup window closing

4. **User completes authentication in the popup**
   - After successful Google auth, Google redirects to our callback URL
   - The popup callback page receives the auth code
   - The code is exchanged for a session
   - The popup window closes automatically

5. **Main window detects authentication**
   - The auth context's `onAuthStateChange` listener detects the new session
   - The user state updates, causing the auth modal to close
   - The file upload proceeds with the authenticated user

### Benefits

- **State Preservation**: The user's selected file remains intact during authentication
- **Seamless Experience**: No page reloads or redirects in the main application
- **Modern Pattern**: Similar to authentication patterns in popular web applications

## Technical Implementation

The key technical aspects that make this work:

1. **Supabase OAuth Options**:
   ```typescript
   await supabase.auth.signInWithOAuth({
     provider: 'google',
     options: {
       redirectTo: `${window.location.origin}/auth/popup-callback`,
       skipBrowserRedirect: true, // Critical for popup flow
     }
   })
   ```

2. **Popup Window Management**:
   ```typescript
   const authWindow = openPopupWindow(authUrl, 'Sign in with Google', 580, 600)
   
   // Poll for popup closing
   const pollTimer = setInterval(() => {
     if (!authWindow || authWindow.closed) {
       clearInterval(pollTimer)
     }
   }, 500)
   ```

3. **Shared Authentication State**:
   - Both the main window and popup share the same Supabase client
   - When the popup creates a session, it's available to the main window
   - The auth state listener in the main window detects the new session

## Troubleshooting

If authentication issues occur:

1. **Popup Blocked**: Ensure popups are allowed for your domain
2. **Redirect URL**: Verify that `/auth/popup-callback` is allowed in Supabase Auth settings
3. **Session Sharing**: Confirm that cookies are properly shared between windows 