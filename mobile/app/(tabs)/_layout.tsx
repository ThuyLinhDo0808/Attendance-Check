import React, { useEffect, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';

export default function TabLayout() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        // Kiểm tra xem trong máy đã lưu mã nhân viên chưa
        const code = await AsyncStorage.getItem('employee_code');
        
        if (!code) {
          // Chưa có -> Chuyển hướng sang màn hình Login
          router.replace('/login');
        } else {
          // Đã có -> Cho phép hiển thị các Tab
          setIsChecking(false);
        }
      } catch (error) {
        console.error("Lỗi kiểm tra đăng nhập:", error);
        setIsChecking(false);
      }
    };

    checkLoginStatus();
  }, []);

  // Hiển thị vòng xoay tải dữ liệu trong tích tắc khi đang kiểm tra
  if (isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#3B82F6', headerShown: false }}>
      {/* Tab 1: Màn hình Check-in */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Điểm danh',
          tabBarIcon: ({ color, size }) => <Ionicons name="qr-code-outline" size={size} color={color} />,
        }}
      />
      
      {/* Tab 2: Màn hình Báo cáo sự cố AI */}
      <Tabs.Screen
        name="excuse"
        options={{
          title: 'Báo cáo AI',
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles-outline" size={size} color={color} />,
        }}
      />
      
      {/* Tab 3: Màn hình Hồ sơ cá nhân */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Hồ sơ',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}