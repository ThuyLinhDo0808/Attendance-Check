// Single source of truth for where the mobile app talks to the backend.
//
// Set EXPO_PUBLIC_API_URL (in mobile/.env, or as an EAS build env var) to
// the deployed API, e.g. https://attendance-api.onrender.com/api.
// Expo inlines EXPO_PUBLIC_* variables at bundle time, so restart
// `npx expo start` after changing it.
const DEFAULT_API_URL = 'https://attendance-check-api.onrender.com/api';

export const BACKEND_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
