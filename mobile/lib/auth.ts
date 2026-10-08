import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const TOKEN_KEY = 'auth_token';

/** Stores the login token and the signed-in employee's details. */
export async function saveSession(token: string, employeeCode: string, name: string) {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    ['employee_code', employeeCode],
    ['employee_name', name],
  ]);
}

export async function clearSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, 'employee_code', 'employee_name']);
}

/**
 * fetch() that sends the login token. If the server says the session is
 * missing or expired (401), the stored session is cleared and the user is
 * sent back to the login screen.
 */
export async function authFetch(url: string, options: RequestInit = {}) {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    await clearSession();
    router.replace('/login');
  }
  return response;
}
