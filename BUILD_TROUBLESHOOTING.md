# Build Troubleshooting Guide

## Current Issue: Build Failing During "Install Dependencies"

The build is failing during the "Install dependencies" phase, which happens **before** any code runs. This suggests it's not a Firebase initialization issue.

## Steps to Debug:

### 1. Check Build Logs
Visit the build logs URL from your last build:
```
https://expo.dev/accounts/mansiroy7611/projects/petnutri/builds/[BUILD_ID]
```

Look for:
- Specific error messages in the "Install dependencies" phase
- Node version compatibility issues
- Dependency conflicts
- Network/timeout errors

### 2. Common Causes:

#### A. Node Version Mismatch
- Check if your `package.json` specifies a Node version
- EAS Build uses Node 20.x by default
- Some packages might require specific Node versions

#### B. Dependency Conflicts
- Check for conflicting versions in `package.json`
- React 19.1.0 with React Native 0.81.5 might have compatibility issues
- Firebase 12.7.0 should be compatible

#### C. Missing Native Dependencies
- Some packages require native code compilation
- Check if all dependencies are compatible with Expo SDK 54

### 3. Try These Fixes:

#### Option 1: Add Node Version to eas.json
```json
{
  "build": {
    "preview": {
      "node": "20.x.x",
      "android": {
        "buildType": "apk"
      },
      "distribution": "internal"
    }
  }
}
```

#### Option 2: Clear Build Cache
```bash
eas build -p android --profile preview --clear-cache
```

#### Option 3: Check for Postinstall Scripts
Some packages have postinstall scripts that might fail. Check `package.json` for any `postinstall` scripts.

#### Option 4: Simplify Dependencies Temporarily
Try removing non-essential dependencies to isolate the issue.

### 4. Environment Variables Status
✅ All 6 Firebase environment variables are set correctly in EAS:
- EXPO_PUBLIC_FIREBASE_API_KEY
- EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
- EXPO_PUBLIC_FIREBASE_PROJECT_ID
- EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
- EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- EXPO_PUBLIC_FIREBASE_APP_ID

### 5. Next Steps:
1. Check the build logs URL for the specific error
2. Share the error message from the logs
3. Try building with `--clear-cache` flag
4. Consider updating React Native version if there are compatibility issues

## Quick Test:
Try building with verbose logging:
```bash
eas build -p android --profile preview --clear-cache --non-interactive
```

This will show more detailed error messages.

