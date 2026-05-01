import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
const LOGO_URI = "https://customer-assets.emergentagent.com/job_blood-connect-66/artifacts/g4daxn7b_vallalars_friends_blood_support_400.webp";

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      Alert.alert("Invalid", "Please enter a valid 10-digit phone number");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: digits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      router.push({ pathname: "/otp", params: { phone: digits } });
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not send OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.heroWrap}>
            <Image source={{ uri: LOGO_URI }} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.brand} testID="app-title">Vallalar&apos;s Friends{"\n"}Blood Support</Text>
          <Text style={styles.tagline}>
            Your Blood Saves Many Lives — Donate Today, Be a Hero
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Phone number</Text>
            <View style={styles.phoneRow}>
              <View style={styles.ccBox}><Text style={styles.ccText}>+91</Text></View>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="9876543210"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                maxLength={10}
                style={styles.input}
                testID="login-phone-input"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={sendOtp}
              disabled={loading}
              testID="send-otp-btn"
            >
              {loading ? <ActivityIndicator color="#fff" /> :
                <Text style={styles.primaryBtnText}>Send OTP</Text>}
            </TouchableOpacity>

            <Text style={styles.devHint}>
              Login OTP is <Text style={{ fontWeight: "800", color: "#DC2626", fontSize: 16 }}>123456</Text>
            </Text>
          </View>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push("/register")}
            testID="open-register-link"
          >
            <MaterialCommunityIcons name="account-plus" size={18} color="#DC2626" />
            <Text style={styles.secondaryBtnText}>New Donor? Register here</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.adminLink}
            onPress={() => router.push("/admin")}
            testID="open-admin-link"
          >
            <MaterialCommunityIcons name="shield-lock-outline" size={16} color="#64748B" />
            <Text style={styles.adminLinkText}>Admin panel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  scroll: { padding: 20, paddingTop: 20 },
  heroWrap: { alignItems: "center", marginBottom: 16 },
  logo: { width: 160, height: 160 },
  brand: { fontSize: 22, fontWeight: "800", color: "#0F172A", letterSpacing: -0.3, textAlign: "center", lineHeight: 28 },
  tagline: { textAlign: "center", color: "#DC2626", marginTop: 10, marginBottom: 24, fontSize: 13, fontWeight: "700", lineHeight: 18, paddingHorizontal: 10 },
  card: {
    backgroundColor: "#fff", borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: "#E2E8F0",
  },
  label: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  phoneRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  ccBox: { backgroundColor: "#F1F5F9", paddingHorizontal: 14, justifyContent: "center", borderRadius: 12 },
  ccText: { fontWeight: "700", color: "#0F172A" },
  input: {
    flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 17, color: "#0F172A",
  },
  primaryBtn: { backgroundColor: "#DC2626", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  devHint: { textAlign: "center", color: "#64748B", marginTop: 14, fontSize: 13 },
  secondaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1.5, borderColor: "#FECACA", backgroundColor: "#FEF2F2",
    borderRadius: 14, paddingVertical: 14, marginTop: 16,
  },
  secondaryBtnText: { color: "#DC2626", fontWeight: "700", fontSize: 14 },
  adminLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 20, padding: 10 },
  adminLinkText: { color: "#64748B", fontWeight: "600", fontSize: 13 },
});
