# Build Android APK using EAS
Write-Host "Starting EAS Build for Android APK..."
Write-Host "Make sure you are logged in to Expo (npx expo login) and have EAS CLI installed (npm i -g eas-cli)"

npx eas-cli build --platform android --profile preview

Write-Host "Build finished. Check your Expo dashboard for the download link."
