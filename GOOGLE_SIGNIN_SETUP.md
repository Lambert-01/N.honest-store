# Setting Up Google Sign-In for N.Honest

This guide will help you set up Google Sign-In for your N.Honest application.

## Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Credentials"

## Step 2: Configure OAuth Consent Screen

1. Click on "OAuth consent screen" in the left sidebar
2. Select "External" user type (unless you have a Google Workspace organization)
3. Fill in the required information:
   - App name: N.Honest
   - User support email: Your email
   - Developer contact information: Your email
4. Click "Save and Continue"
5. Add scopes: `.../auth/userinfo.email`, `.../auth/userinfo.profile`
6. Click "Save and Continue" and complete the setup

## Step 3: Create OAuth Client ID

1. Click on "Credentials" in the left sidebar
2. Click "Create Credentials" > "OAuth client ID"
3. Application type: Web application
4. Name: N.Honest Web Client
5. Authorized JavaScript origins:
   - Add `http://localhost:3000` for development
   - Add your production domain when ready
6. Authorized redirect URIs:
   - Add `http://localhost:3000` for development
   - Add your production domain when ready
7. Click "Create"

## Step 4: Update Your Application

1. Copy your Client ID from the credentials page
2. Open `.env` file and add:
   ```
   CLIENT_ID=your_client_id_here
   ```
3. Open `js/account.js` and replace `YOUR_CLIENT_ID` with your actual Client ID

## Step 5: Install Dependencies

Run the following command to install the required dependencies:

```
npm install
```

## Step 6: Test Your Integration

1. Start your application with `npm start`
2. Try signing in with Google
3. Check the browser console and server logs for any errors

## Troubleshooting

- If you see "popup_closed_by_user" errors, make sure your origins are correctly configured
- If authentication fails, check your Client ID is correctly set in both client and server
- For other issues, check the Google OAuth documentation or contact support
