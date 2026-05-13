# QueueLess Mobile

Expo React Native customer app for QueueLess.

## Run Locally

```bash
npm install
npm run start
```

Open the app in an Android emulator, iOS simulator, Expo Go, or a development build from the Expo CLI prompt.

## Scripts

- `npm run start` starts Expo.
- `npm run android` runs a native Android build.
- `npm run ios` runs a native iOS build.
- `npm run build:android` starts an EAS Android build.
- `npm run build:ios` starts an EAS iOS build.

## Main Areas

- Discover nearby shops
- View shop details, services, queue status, and available appointments
- Join queues and manage tokens
- Book appointments and verify payments
- Review completed visits
- Track loyalty rewards and referrals
- Manage profile and push notification alerts

## API Configuration

The app uses `extra.apiUrl` from `app.json`, then adapts localhost for emulators and Expo development hosts. For a physical device, use a reachable LAN or deployed backend URL.
