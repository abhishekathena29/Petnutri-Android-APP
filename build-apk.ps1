# Build APK Script for PetNutri App
Write-Host "Building APK for PetNutri..." -ForegroundColor Green

# Step 1: Generate native Android project
Write-Host "`nStep 1: Generating Android native project..." -ForegroundColor Yellow
npx expo prebuild --platform android --clean

# Step 2: Build release APK
Write-Host "`nStep 2: Building release APK..." -ForegroundColor Yellow
cd android
./gradlew assembleRelease

# Step 3: Locate the APK
Write-Host "`nStep 3: APK location..." -ForegroundColor Yellow
$apkPath = "app\build\outputs\apk\release\app-release.apk"
if (Test-Path $apkPath) {
    Write-Host "`n✅ APK built successfully!" -ForegroundColor Green
    Write-Host "Location: $PWD\$apkPath" -ForegroundColor Cyan
    Write-Host "`nYou can find your APK at: android\app\build\outputs\apk\release\app-release.apk" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ APK not found. Check for errors above." -ForegroundColor Red
}

cd ..

