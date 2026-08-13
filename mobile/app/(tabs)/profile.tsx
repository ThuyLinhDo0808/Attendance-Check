import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

// ⚠️ NHỚ ĐỔI IP MÁY TÍNH CỦA BẠN VÀO ĐÂY
const BACKEND_URL = 'http://192.168.103.174:4000/api';

export default function ProfileScreen() {
  const [profile, setProfile] = useState({ name: 'Đang tải...', code: '' });
  const [stats, setStats] = useState({ times_late: 0, total_fine: 0 });
  const [loading, setLoading] = useState(true);

  // Dùng useFocusEffect để mỗi lần bấm vào tab Hồ sơ, nó sẽ tự động tải lại dữ liệu mới nhất
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadData = async () => {
        try {
          // Lấy thông tin đã lưu lúc Login
          const code = await AsyncStorage.getItem('employee_code');
          const name = await AsyncStorage.getItem('employee_name');
          
          if (isActive) {
            setProfile({ name: name || 'Nhân viên', code: code || '' });
          }

          if (code) {
            // Gọi API Analytics của Backend để lấy thống kê
            const res = await fetch(`${BACKEND_URL}/analytics/employee/${code}`);
            const data = await res.json();
            
            if (isActive && data.stats) {
              setStats({
                times_late: data.stats.times_late,
                total_fine: data.stats.total_fine
              });
            }
          }
        } catch (error) {
          console.error("Lỗi khi tải Profile:", error);
        } finally {
          if (isActive) setLoading(false);
        }
      };

      loadData();
      return () => { isActive = false; };
    }, [])
  );

  // Tạo chữ cái đầu để làm Avatar (VD: Đỗ Thùy Linh -> Đ)
  const avatarLetter = profile.name.charAt(0).toUpperCase();

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Thẻ nhân viên điện tử */}
      <View style={styles.card}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{avatarLetter}</Text>
        </View>
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.role}>Mã NV: {profile.code}</Text>
      </View>

      {/* Thống kê chuyên cần */}
      <Text style={styles.sectionTitle}>Hiệu suất của bạn</Text>
      <View style={styles.statsContainer}>
        <View style={[styles.statBox, { backgroundColor: '#FDE8E8' }]}>
          <Text style={[styles.statNumber, { color: '#9B1C1C' }]}>{stats.times_late}</Text>
          <Text style={styles.statLabel}>Lần đi muộn</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: '#FEF3C7' }]}>
          <Text style={[styles.statNumber, { color: '#92400E' }]}>
            {stats.total_fine.toLocaleString('vi-VN')}đ
          </Text>
          <Text style={styles.statLabel}>Tiền phạt</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F3F4F6' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 4, marginBottom: 24 },
  avatarContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  name: { fontSize: 22, fontWeight: 'bold', color: '#1F2937', marginBottom: 4 },
  role: { fontSize: 16, color: '#4B5563', fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginBottom: 12 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', marginHorizontal: 6 },
  statNumber: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  statLabel: { fontSize: 14, color: '#374151' }
});