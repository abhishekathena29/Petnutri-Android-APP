# EAS Build Setup Guide

## Step-by-Step Instructions to Fix Build Crash

### Step 1: Delete Old Secrets (if they exist)

First, delete the old secrets created with the deprecated command:
```bash
eas secret:delete --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY
eas secret:delete --scope project --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
eas secret:delete --scope project --name EXPO_PUBLIC_FIREBASE_PROJECT_ID
eas secret:delete --scope project --name EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
eas secret:delete --scope project --name EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
eas secret:delete --scope project --name EXPO_PUBLIC_FIREBASE_APP_ID
```

### Step 2: Set Firebase Environment Variables Using New Command

Now create environment variables using the new `eas env:create` command. Run these one by one:

```bash
# Set Firebase API Key
eas env:create --name EXPO_PUBLIC_FIREBASE_API_KEY --value "AIzaSyCRCfUSGd_Qa4HvRpX1UOUCRCPAgkJrlF0" --type string --environment preview

# Set Firebase Auth Domain
eas env:create --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value "petnutri-cd0aa.firebaseapp.com" --type string --environment preview

# Set Firebase Project ID
eas env:create --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value "petnutri-cd0aa" --type string --environment preview

# Set Firebase Storage Bucket
eas env:create --name EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET --value "petnutri-cd0aa.firebasestorage.app" --type string --environment preview

# Set Firebase Messaging Sender ID
eas env:create --name EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID --value "982811179554" --type string --environment preview

# Set Firebase App ID
eas env:create --name EXPO_PUBLIC_FIREBASE_APP_ID --value "1:982811179554:web:fbc635e1d37c52d688687b" --type string --environment preview
```

**Note:** Use `--type string` (not `secret`). EAS will automatically handle encryption for sensitive values.

**Note:** The `--environment preview` flag ensures these variables are available during preview builds. For production builds, you'll need to create them again with `--environment production`.

### Step 3: Verify Environment Variables Are Set

Check that all environment variables are created:
```bash
eas env:list --environment preview
```

You should see all 6 Firebase environment variables listed.

### Step 3: Rebuild the App

After setting all secrets, rebuild your app:
```bash
eas build -p android --profile preview
```

### Step 4: Wait for Build to Complete

The build will take 10-20 minutes. You can:
- Wait in the terminal
- Or check the build status at: https://expo.dev/accounts/mansiroy7611/projects/petnutri/builds

### Step 5: Download and Install APK

Once the build completes:
1. You'll get a QR code and download link
2. Scan the QR code with your Android phone or download the APK
3. Install the APK on your device
4. The app should now open without crashing!

## Troubleshooting

### If build still fails:
1. Check the build logs at the URL provided
2. Look for any error messages about missing dependencies
3. Make sure all 6 Firebase secrets are set correctly

### If app still crashes after install:
1. Check device logs: `adb logcat | grep -i error`
2. Verify Firebase config values are correct
3. Make sure you're using the correct Firebase project

## Quick Reference

Your Firebase Config Values:
- API Key: AIzaSyCRCfUSGd_Qa4HvRpX1UOUCRCPAgkJrlF0
- Auth Domain: petnutri-cd0aa.firebaseapp.com
- Project ID: petnutri-cd0aa
- Storage Bucket: petnutri-cd0aa.firebasestorage.app
- Messaging Sender ID: 982811179554
- App ID: 1:982811179554:web:fbc635e1d37c52d688687b

