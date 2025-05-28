# AEF Cockpit Authentication

This document explains the authentication system integrated into the AEF Execution Cockpit.

## Overview

The AEF Cockpit uses the same popup-based authentication system as the main Runops application. This allows users to sign in with Google OAuth or email/password to access their completed workflows and execution data.

## Components

### 1. AuthProvider (`src/lib/auth-context.tsx`)
- Manages authentication state across the application
- Implements popup-based Google OAuth sign-in
- Handles email/password authentication
- Provides user session management

### 2. AuthModal (`src/components/AuthModal.tsx`)
- Simplified authentication modal for the cockpit
- Supports both Google OAuth and email/password
- Shows verification instructions for email signup
- Automatically closes when authentication succeeds

### 3. Popup Callback (`public/auth/popup-callback.html`)
- Standalone HTML page that handles OAuth redirects
- Exchanges authentication codes for sessions
- Closes popup window after successful authentication
- Uses Supabase client directly via CDN

### 4. WorkflowSelector Integration
- Shows authentication required message when not signed in
- Displays loading states during authentication
- Fetches workflows only for authenticated users
- Shows user email and workflow count

## Authentication Flow

1. **User opens AEF Cockpit**
   - App checks for existing authentication session
   - Shows "Sign In" button if not authenticated

2. **User clicks "Sign In"**
   - AuthModal opens with Google and email options
   - User can choose authentication method

3. **Google OAuth Flow**
   - Popup window opens with Google authentication
   - User completes authentication in popup
   - Popup callback page exchanges code for session
   - Main window detects authentication and closes modal

4. **Email/Password Flow**
   - User enters credentials in modal
   - For signup: verification email sent, instructions shown
   - For signin: immediate authentication if credentials valid

5. **Authenticated State**
   - WorkflowSelector fetches user's completed workflows
   - User can select workflows to convert to execution plans
   - User email displayed in interface

## Configuration

The authentication system uses the same Supabase configuration as the main app:

- **Supabase URL**: `https://ypnnoivcybufgsrbzqkt.supabase.co`
- **Anon Key**: Configured in `src/lib/supabase.ts`
- **OAuth Redirect**: `${window.location.origin}/auth/popup-callback`

## Security Features

- Uses Supabase's built-in security features
- Popup-based OAuth prevents main window redirects
- Session tokens stored securely by Supabase client
- Automatic session refresh and validation

## Error Handling

- Network errors during workflow fetching
- Authentication failures with user-friendly messages
- Popup blocking detection and guidance
- Session expiration handling

## Testing

To test the authentication system:

1. Open `http://localhost:3000`
2. Click "Sign In" button
3. Try both Google OAuth and email authentication
4. Verify workflows load after authentication
5. Test sign out functionality

## Integration with Main App

The AEF Cockpit shares the same authentication backend as the main Runops application, so users can use the same credentials across both systems. 