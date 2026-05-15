# AEGIS Crisis Management — Agent Rules
## GCP Project: aegis-496207 | Region: asia-south1
## Stack: React Native + Expo (mobile), Node.js Express (cloud-run/)
## Rules for all agents:
- Never delete any existing file
- Never modify any existing screen component
- All new backend code goes in cloud-run/src/
- All new Firestore hooks go in lib/firestore/hooks.ts
- All API calls return { success, data, error } format
- All agents write output to Firestore before returning
- Every API call has try/catch with mock fallback
- Mock fallback is always the existing mock data already in the codebase
- Never hardcode API keys — always read from process.env
- GCP project is aegis-496207, region is asia-south1
- Service account: firebase-adminsdk-fbsvc@aegis-496207.iam.gserviceaccount.com
