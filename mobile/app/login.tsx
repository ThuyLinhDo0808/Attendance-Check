import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { saveSession } from '@/lib/auth';
import { BACKEND_URL } from '@/constants/api';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      Alert.alert('Lỗi', 'Vui lòng nhập tài khoản và mật khẩu.');
      return;
    }
    try {
      const response = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const result = await response.json();

      if (result.success) {
        // Lưu token đăng nhập và thông tin (employee_code, name) vào bộ nhớ điện thoại
        await saveSession(result.token, result.data.employee_code, result.data.name);
        
        Alert.alert('Thành công', `Chào mừng ${result.data.name}`);
        
        // Chuyển hướng vào màn hình chính (các Tab)
        router.replace('/(tabs)');
      } else {
        Alert.alert('Lỗi', result.message);
      }
    } catch (error) {
      Alert.alert('Lỗi kết nối', 'Không thể kết nối đến Backend');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Đăng nhập</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Mã nhân viên"
        autoCapitalize="characters"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Mật khẩu"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>VÀO ỨNG DỤNG</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#F3F4F6' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 40, textAlign: 'center', color: '#1F2937' },
  input: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#D1D5DB', fontSize: 16 },
  button: { backgroundColor: '#3B82F6', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});