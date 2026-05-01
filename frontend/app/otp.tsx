import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
const LEN = 6;

export default function OtpScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(""));
  const [loading, setLoading] = useState(false);
  const refs = useRef<(TextInput | null)[]>([]);

  useEffect(() => { setTimeout(() => refs.current[0]?.focus(), 200); }, []);

  const onChange = (idx: number, v: string) => {
    const ch = v.replace(/\D/g, "").slice(-1);
    const next = [...digits]; next[idx] = ch; setDigits(next);
    if (ch && idx < LEN - 1) refs.current[idx + 1]?.focus();
  };
  const onKey = (idx: number, key: string) => {
    if (key === "Backspace" && !digits[idx] && idx > 0) refs.current[idx - 1]?.focus();
  };

  const verify = async () => {
    const code = digits.join("");
    if (code.length < LEN) { Alert.alert("Enter 6-digit OTP"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Invalid OTP");
      await AsyncStorage.setItem("auth_token", data.token);
      await AsyncStorage.setItem("auth_phone", data.phone);
      if (data.is_donor && data.donor) {
        await AsyncStorage.setItem("donor_profile", JSON.stringify(data.donor));
        router.replace("/profile");
      } else {
        router.replace("/home");
      }
    } catch (e: any) {
      Alert.alert("Invalid OTP", e.message || "Please try again");
    } finally { setLoading(false); }
  };

  const resend = async () => {
    await fetch(`${BACKEND}/api/auth/send-otp`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_number: phone }),
    });
    Alert.alert("OTP resent", "Use 123456 in dev mode.");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()} testID="otp-back-btn">
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.content}>
          <MaterialCommunityIcons name="message-text" size={48} color="#DC2626" />
          <Text style={styles.title}>Verify your number</Text>
          <Text style={styles.sub}>6-digit code sent to +91 {phone}</Text>

          <View style={styles.devOtpBox} testID="dev-otp-banner">
            <MaterialCommunityIcons name="information" size={16} color="#DC2626" />
            <Text style={styles.devOtpText}>
              Use OTP <Text style={styles.devOtpCode}>123456</Text> to log in
            </Text>
          </View>

          <View style={styles.row}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(r) => { refs.current[i] = r; }}
                value={d}
                onChangeText={(v) => onChange(i, v)}
                onKeyPress={({ nativeEvent }) => onKey(i, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={1}
                style={[styles.box, d ? styles.boxFilled : null]}
                testID={`otp-box-${i}`}
              />
            ))}
          </View>
          <TouchableOpacity style={[styles.primaryBtn, loading && { opacity: 0.7 }]} onPress={verify} disabled={loading} testID="verify-otp-btn">
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Verify</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={resend} style={{ marginTop: 16 }}>
            <Text style={styles.resend}>Didn&apos;t get it? Resend OTP</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  back: { padding: 14, width: 50 },
  content: { flex: 1, padding: 24, paddingTop: 10 },
  title: { fontSize: 26, fontWeight: "800", color: "#0F172A", marginTop: 14, letterSpacing: -0.5 },
  sub: { color: "#475569", marginTop: 6, fontSize: 15 },
  row: { flexDirection: "row", gap: 10, marginTop: 30, marginBottom: 24 },
  box: { width: 46, height: 56, borderRadius: 12, borderWidth: 1.5, borderColor: "#E2E8F0", textAlign: "center", fontSize: 22, fontWeight: "700", color: "#0F172A", backgroundColor: "#fff" },
  boxFilled: { borderColor: "#DC2626", backgroundColor: "#FEF2F2" },
  primaryBtn: { backgroundColor: "#DC2626", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  resend: { textAlign: "center", color: "#DC2626", fontWeight: "600" },
  devOtpBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA",
    borderRadius: 12, padding: 12, marginTop: 16,
  },
  devOtpText: { flex: 1, color: "#7F1D1D", fontSize: 13, fontWeight: "600" },
  devOtpCode: { color: "#DC2626", fontWeight: "900", fontSize: 15, letterSpacing: 1 },
});
