import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = 'http://192.168.103.174:4000/api';

export default function ExcuseScreen() {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmitToAI = async () => {
    setLoading(true);
    Keyboard.dismiss(); // Đóng bàn phím khi nhấn nút gửi
    
    try {
      // 1. Lấy mã nhân viên đang đăng nhập từ bộ nhớ
      const empCode = await AsyncStorage.getItem('employee_code');
      
      if (!empCode) {
        Alert.alert("Lỗi", "Không tìm thấy thông tin nhân viên. Vui lòng đăng nhập lại.");
        setLoading(false);
        return;
      }

      // 2. Gửi yêu cầu phân tích xuống Backend thực tế
      const response = await fetch(`${BACKEND_URL}/attendance/excuse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_code: empCode, reason: reason }),
      });

      const result = await response.json();

      // 3. Xử lý kết quả trả về với độ trễ để tránh lỗi Alert chồng nhau
      setTimeout(() => {
        if (result.success) {
          Alert.alert('Báo cáo thành công', result.message);
          setReason(''); // Xóa nội dung ô chữ sau khi gửi thành công
        } else {
          Alert.alert('Lỗi', result.message || 'Xử lý thất bại.');
        }
      }, 500);

    } catch (error) {
      setTimeout(() => {
        Alert.alert('Lỗi kết nối', 'Không thể kết nối đến máy chủ.');
      }, 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Báo cáo Lý do Đi muộn</Text>
      <Text style={styles.subTitle}>Nhập lý do đi muộn của bạn.</Text>

      <TextInput
        style={styles.input}
        placeholder="Ví dụ: Sáng nay tuyến đường bị ngập nặng..."
        placeholderTextColor="#9CA3AF"
        multiline
        numberOfLines={4}
        value={reason}
        onChangeText={setReason}
      />

      <TouchableOpacity 
        style={[styles.submitButton, loading && styles.disabledButton]} 
        onPress={handleSubmitToAI}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Giải trình lý do</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F9FAFB', justifyContent: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1F2937', marginBottom: 8 },
  subTitle: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 16, textAlignVertical: 'top', height: 120, marginBottom: 20 },
  submitButton: { backgroundColor: '#8B5CF6', padding: 16, borderRadius: 8, alignItems: 'center' },
  disabledButton: { backgroundColor: '#C4B5FD' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});