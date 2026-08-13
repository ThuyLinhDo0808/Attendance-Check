import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

export default function CheckInScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [empCode, setEmpCode] = useState('');
  const router = useRouter();

  const isScanningRef = useRef(false);

  const BACKEND_URL = 'http://192.168.103.174:4000/api';

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();

    (async () => {
      const code = await AsyncStorage.getItem('employee_code');
      if (code) setEmpCode(code);
    })();
  }, []);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;
    setScanned(true); 
    
    Alert.alert(
      "Xác nhận Check-in", 
      `Mã QR đã quét thành công.\nNhân viên: ${empCode}`,
      [
        { 
          text: "Hủy", 
          onPress: () => {
            isScanningRef.current = false; 
            setScanned(false);
          }, 
          style: "cancel" 
        },
        { 
          text: "Gửi điểm danh", 
          onPress: async () => {
            try {
              const response = await fetch(`${BACKEND_URL}/attendance/checkin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employee_code: empCode, qr_data: data }), 
              });

              const result = await response.json();

              setTimeout(() => {
                if (result.success) {
                  Alert.alert("Tuyệt vời!", "Điểm danh thành công!", [
                    { 
                      text: "Xem Hồ Sơ", 
                      onPress: () => {
                        isScanningRef.current = false;
                        setScanned(false);
                        router.push('/profile');
                      }
                    }
                  ]);
                } else {
                  Alert.alert("Lỗi", result.message || "Điểm danh thất bại.", [
                    { 
                      text: "Đóng", 
                      onPress: () => {
                        isScanningRef.current = false;
                        setScanned(false);
                      } 
                    }
                  ]);
                }
              }, 500);

            } catch (error) {
              setTimeout(() => {
                Alert.alert("Lỗi kết nối", "Không thể kết nối đến máy chủ!", [
                  { 
                    text: "Đóng", 
                    onPress: () => {
                      isScanningRef.current = false; 
                      setScanned(false);
                    } 
                  }
                ]);
              }, 500);
            } 
          } 
        }
      ]
    );
  };

  if (hasPermission === null) {
    return <View style={styles.center}><Text>Đang yêu cầu quyền sử dụng Camera...</Text></View>;
  }
  if (hasPermission === false) {
    return <View style={styles.center}><Text style={styles.errorText}>Không có quyền truy cập Camera!</Text></View>;
  }

  return (
    <View style={styles.container}>
      <CameraView
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        style={StyleSheet.absoluteFillObject}
      />
      
      <View style={styles.overlay}>
        <Text style={styles.instructionText}>Chĩa camera vào mã QR tại văn phòng để Check-in</Text>
        {scanned && (
          <TouchableOpacity style={styles.button} onPress={() => setScanned(false)}>
            <Text style={styles.buttonText}>Quét lại</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: 'red', fontSize: 16 },
  overlay: { position: 'absolute', bottom: 50, left: 20, right: 20, alignItems: 'center' },
  instructionText: { color: '#fff', fontSize: 16, backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 8, textAlign: 'center', marginBottom: 20 },
  button: { backgroundColor: '#3B82F6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});