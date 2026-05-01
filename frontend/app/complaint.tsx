import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function ComplaintScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !details.trim()) {
      Alert.alert("Missing info", "Please fill all the fields");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      Alert.alert("Invalid phone", "Enter a valid 10-digit phone number");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/complaints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.replace(/\D/g, ""),
          details: details.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      Alert.alert("Complaint Registered", "Thank you. We will review and respond as needed.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not submit complaint");
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="complaint-back-btn">
            <MaterialCommunityIcons name="arrow-left" size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Register a Complaint</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name="alert-decagram" size={44} color="#DC2626" />
          </View>
          <Text style={styles.h1}>We&apos;re listening</Text>
          <Text style={styles.sub}>Tell us what went wrong. We take every report seriously.</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Your Name *</Text>
            <TextInput
              value={name} onChangeText={setName}
              placeholder="Full Name" placeholderTextColor="#94A3B8"
              style={styles.input} testID="complaint-name"
            />
            <Text style={styles.label}>Your Phone *</Text>
            <TextInput
              value={phone} onChangeText={setPhone}
              placeholder="10-digit mobile" placeholderTextColor="#94A3B8"
              keyboardType="phone-pad" maxLength={10}
              style={styles.input} testID="complaint-phone"
            />
            <Text style={styles.label}>Complaint Details *</Text>
            <TextInput
              value={details} onChangeText={setDetails}
              placeholder="Describe your complaint in detail..." placeholderTextColor="#94A3B8"
              multiline numberOfLines={6}
              style={[styles.input, styles.textArea]}
              testID="complaint-details"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
            onPress={submit}
            disabled={loading}
            testID="complaint-submit-btn"
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <MaterialCommunityIcons name="send" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Submit Complaint</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  scroll: { padding: 20 },
  iconWrap: { alignItems: "center", marginTop: 10 },
  h1: { fontSize: 24, fontWeight: "800", color: "#0F172A", textAlign: "center", marginTop: 8 },
  sub: { color: "#475569", textAlign: "center", marginTop: 4, marginBottom: 16, fontSize: 14 },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "600", color: "#475569", marginBottom: 6, marginTop: 10, textTransform: "uppercase", letterSpacing: 0.3 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: "#0F172A" },
  textArea: { minHeight: 140, textAlignVertical: "top" },
  primaryBtn: { backgroundColor: "#DC2626", borderRadius: 14, paddingVertical: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
