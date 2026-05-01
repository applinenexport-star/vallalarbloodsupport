import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import SelectPicker from "../components/SelectPicker";
import { INDIAN_STATES, INDIA_STATES_CITIES, BLOOD_GROUPS } from "../data/indiaStatesCities";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [bg, setBg] = useState("");
  const [state, setState] = useState("Tamil Nadu");
  const [city, setCity] = useState("");
  const [town, setTown] = useState("");
  const [diabetic, setDiabetic] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showDiabeticWarning, setShowDiabeticWarning] = useState(false);

  const onPickDiabetic = (opt: string) => {
    if (diabetic === opt) { setDiabetic(""); return; }
    if (opt === "Diabetic") {
      setShowDiabeticWarning(true); // will set on "I Understand"
      return;
    }
    setDiabetic(opt);
  };

  const cities = INDIA_STATES_CITIES[state] || [];

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !age || !bg || !state || !city) {
      Alert.alert("Missing info", "Please fill all mandatory fields (Name, Phone, Age, Blood Group, State, City)");
      return;
    }
    const a = parseInt(age, 10);
    if (!a || a < 16 || a > 80) { Alert.alert("Invalid age", "Age must be between 16 and 80"); return; }
    if (phone.replace(/\D/g, "").length < 10) { Alert.alert("Invalid phone", "Enter 10-digit phone"); return; }

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/donors/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.replace(/\D/g, ""),
          email: email.trim() || null,
          age: a,
          blood_group: bg,
          state,
          city,
          town: town.trim() || null,
          diabetic: diabetic || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed");
      await AsyncStorage.setItem("donor_profile", JSON.stringify(data));
      await AsyncStorage.setItem("auth_phone", phone.replace(/\D/g, ""));
      Alert.alert("Registered!", `Welcome ${data.name}. You are now a registered donor.`, [
        { text: "OK", onPress: () => router.replace("/") },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not register");
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="register-back-btn">
            <MaterialCommunityIcons name="arrow-left" size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Register as Donor</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.hero}>Save lives. Become a donor.</Text>
          <Text style={styles.heroSub}>Your blood saves many lives. Donate today, be a hero.</Text>

          <View style={styles.card}>
            <Field label="Full Name *" value={name} onChange={setName} placeholder="e.g. Arun Kumar" testID="reg-name" />
            <Field label="Phone Number *" value={phone} onChange={setPhone} placeholder="10-digit mobile" keyboard="phone-pad" maxLength={10} testID="reg-phone" />
            <Field label="Email (optional)" value={email} onChange={setEmail} placeholder="you@example.com" keyboard="email-address" testID="reg-email" />
            <Field label="Age *" value={age} onChange={setAge} placeholder="18" keyboard="number-pad" maxLength={2} testID="reg-age" />

            <Text style={styles.label}>Blood Group *</Text>
            <View style={styles.bgRow}>
              {BLOOD_GROUPS.map((g) => {
                const active = bg === g;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[styles.bgChip, active && styles.bgChipActive]}
                    onPress={() => setBg(g)}
                    testID={`reg-bg-${g}`}
                  >
                    <Text style={[styles.bgChipText, active && styles.bgChipTextActive]}>{g}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Location</Text>
            <SelectPicker
              label="State *"
              value={state}
              options={INDIAN_STATES}
              onChange={(v) => { setState(v); setCity(""); }}
              searchable
              testID="reg-state"
            />
            <SelectPicker
              label="City *"
              value={city}
              options={cities}
              onChange={setCity}
              searchable
              placeholder={state ? "Choose city" : "Select state first"}
              disabled={!state}
              testID="reg-city"
            />
            <Field label="Town / Village / Area (optional)" value={town} onChange={setTown} placeholder="e.g. Saibaba Colony" testID="reg-town" />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Health (optional)</Text>
            <Text style={styles.label}>Diabetic?</Text>
            <View style={styles.diabRow}>
              {["Non-Diabetic", "Diabetic"].map((opt) => {
                const active = diabetic === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.diabChip, active && styles.diabChipActive]}
                    onPress={() => onPickDiabetic(opt)}
                    testID={`reg-diab-${opt}`}
                  >
                    <Text style={[styles.diabText, active && { color: "#fff" }]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
            onPress={submit}
            disabled={loading}
            testID="reg-submit-btn"
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <MaterialCommunityIcons name="heart-plus" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>Register as Donor</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>

        {/* Diabetic Warning Modal */}
        <Modal visible={showDiabeticWarning} transparent animationType="fade" onRequestClose={() => setShowDiabeticWarning(false)}>
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <View style={styles.warnIcon}>
                <MaterialCommunityIcons name="alert" size={36} color="#DC2626" />
              </View>
              <Text style={styles.modalTitle}>Medical Advisory</Text>
              <Text style={styles.modalBody}>
                People with diabetes who are above 40 years of age are advised not to donate blood.
              </Text>
              <TouchableOpacity
                style={styles.understandBtn}
                onPress={() => { setDiabetic("Diabetic"); setShowDiabeticWarning(false); }}
                testID="diabetic-understand-btn"
              >
                <MaterialCommunityIcons name="check-circle" size={18} color="#fff" />
                <Text style={styles.understandBtnText}>I Understand</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDiabeticWarning(false)} style={{ marginTop: 10 }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FieldProps = { label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboard?: any; maxLength?: number; testID?: string };
function Field({ label, value, onChange, placeholder, keyboard, maxLength, testID }: FieldProps) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboard || "default"}
        maxLength={maxLength}
        style={styles.input}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  scroll: { padding: 20, paddingBottom: 40 },
  hero: { fontSize: 24, fontWeight: "800", color: "#0F172A", letterSpacing: -0.5 },
  heroSub: { color: "#475569", marginTop: 4, marginBottom: 16, fontSize: 14 },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#DC2626", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  label: { fontSize: 12, fontWeight: "600", color: "#475569", marginBottom: 6, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.3 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: "#0F172A" },
  bgRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  bgChip: { borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "#fff", borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  bgChipActive: { backgroundColor: "#DC2626", borderColor: "#DC2626" },
  bgChipText: { fontWeight: "700", color: "#475569" },
  bgChipTextActive: { color: "#fff" },
  diabRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  diabChip: { flex: 1, borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  diabChipActive: { backgroundColor: "#DC2626", borderColor: "#DC2626" },
  diabText: { fontWeight: "700", color: "#475569" },
  primaryBtn: { backgroundColor: "#DC2626", borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  modalBg: { flex: 1, backgroundColor: "rgba(15,23,42,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 420, alignItems: "center" },
  warnIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#0F172A", marginBottom: 10 },
  modalBody: { fontSize: 15, color: "#334155", textAlign: "center", lineHeight: 22, marginBottom: 20 },
  understandBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#DC2626", borderRadius: 14, paddingVertical: 14, width: "100%" },
  understandBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  cancelText: { color: "#64748B", fontWeight: "600", padding: 6 },
});
