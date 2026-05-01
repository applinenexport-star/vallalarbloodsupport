import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import SelectPicker from "../components/SelectPicker";
import { INDIAN_STATES, INDIA_STATES_CITIES, BLOOD_GROUPS } from "../data/indiaStatesCities";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function HomeScreen() {
  const router = useRouter();
  const [patientName, setPatientName] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [hospital, setHospital] = useState("");
  const [hospitalCity, setHospitalCity] = useState("");
  const [hospitalPhone, setHospitalPhone] = useState("");
  const [units, setUnits] = useState("");
  const [attenderName, setAttenderName] = useState("");
  const [attenderPhone, setAttenderPhone] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [searchState, setSearchState] = useState("Tamil Nadu");

  const cities = INDIA_STATES_CITIES[searchState] || [];

  const submit = async () => {
    if (!patientName || !bloodGroup || !hospital || !hospitalCity || !hospitalPhone || !units || !attenderName || !attenderPhone) {
      Alert.alert("Missing info", "Please fill all fields");
      return;
    }
    if (!termsAccepted) {
      Alert.alert("Terms & Conditions", "Please accept Terms and Conditions to continue.");
      return;
    }
    const u = parseInt(units, 10);
    if (!u || u < 1) { Alert.alert("Invalid units", "Enter a valid number"); return; }
    if (attenderPhone.replace(/\D/g, "").length < 10) { Alert.alert("Invalid phone"); return; }
    if (hospitalPhone.replace(/\D/g, "").length < 10) { Alert.alert("Invalid hospital phone"); return; }

    const req = {
      patient_name: patientName,
      blood_group: bloodGroup,
      hospital,
      hospital_city: hospitalCity,
      hospital_phone: hospitalPhone.replace(/\D/g, ""),
      units: u,
      attender_name: attenderName,
      attender_phone: attenderPhone.replace(/\D/g, ""),
    };
    await AsyncStorage.setItem("current_request", JSON.stringify(req));
    router.push({ pathname: "/donors", params: { bg: bloodGroup, state: searchState } });
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(["auth_token", "auth_phone", "current_request", "donor_profile"]);
    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <MaterialCommunityIcons name="water" size={22} color="#DC2626" />
            <Text style={styles.brand}>Vallalar&apos;s Friends</Text>
          </View>
          <TouchableOpacity onPress={logout} testID="logout-btn">
            <MaterialCommunityIcons name="logout" size={22} color="#64748B" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.h1}>Blood Request</Text>
          <Text style={styles.sub}>Fill patient details. We&apos;ll build a shareable poster & message.</Text>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Patient</Text>
            <Field label="Patient Name *" value={patientName} onChange={setPatientName} placeholder="e.g. Ravi Kumar" testID="patient-name-input" />
            <Text style={styles.label}>Blood Group Required *</Text>
            <View style={styles.bgRow}>
              {BLOOD_GROUPS.map((g) => {
                const active = bloodGroup === g;
                return (
                  <TouchableOpacity key={g} style={[styles.bgChip, active && styles.bgChipActive]} onPress={() => setBloodGroup(g)} testID={`blood-group-${g}`}>
                    <Text style={[styles.bgChipText, active && styles.bgChipTextActive]}>{g}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Field label="Hospital Name *" value={hospital} onChange={setHospital} placeholder="e.g. Apollo Hospital" testID="hospital-input" />
            <Field label="Hospital City *" value={hospitalCity} onChange={setHospitalCity} placeholder="e.g. Coimbatore" testID="hospital-city-input" />
            <Field label="Hospital / Blood Bank Phone *" value={hospitalPhone} onChange={setHospitalPhone} placeholder="10-digit number" keyboard="phone-pad" maxLength={10} testID="hospital-phone-input" />
            <Field label="Units Required *" value={units} onChange={setUnits} placeholder="e.g. 2" keyboard="number-pad" maxLength={2} testID="units-input" />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Attender (Your contact)</Text>
            <Field label="Attender Name *" value={attenderName} onChange={setAttenderName} placeholder="e.g. Suresh" testID="attender-name-input" />
            <Field label="Attender Phone *" value={attenderPhone} onChange={setAttenderPhone} placeholder="10-digit mobile" keyboard="phone-pad" maxLength={10} testID="attender-phone-input" />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Donor Search Area</Text>
            <SelectPicker
              label="Search State *"
              value={searchState}
              options={INDIAN_STATES}
              onChange={setSearchState}
              searchable
              testID="search-state"
            />
            <Text style={styles.helperText}>We&apos;ll show donors in this state on the next screen.</Text>
          </View>

          {/* Terms & Conditions */}
          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => setTermsAccepted(!termsAccepted)}
            activeOpacity={0.7}
            testID="terms-checkbox"
          >
            <View style={[styles.checkbox, termsAccepted && styles.checkboxOn]}>
              {termsAccepted && <MaterialCommunityIcons name="check" size={14} color="#fff" />}
            </View>
            <Text style={styles.termsText}>
              I agree to the{" "}
              <Text style={styles.termsLink} onPress={() => router.push("/terms")} testID="terms-link">
                Terms and Conditions
              </Text>
              {" "}and will use this platform responsibly.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryBtn, !termsAccepted && { opacity: 0.5 }]}
            disabled={!termsAccepted}
            onPress={submit}
            testID="submit-request-btn"
          >
            <Text style={styles.primaryBtnText}>Continue to Donor Search</Text>
            <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.complaintBtn}
            onPress={() => router.push("/complaint")}
            testID="register-complaint-btn"
          >
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#475569" />
            <Text style={styles.complaintBtnText}>Register a Complaint</Text>
          </TouchableOpacity>
        </ScrollView>
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E2E8F0", backgroundColor: "#fff" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  brand: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  scroll: { padding: 20, paddingBottom: 60 },
  h1: { fontSize: 26, fontWeight: "800", color: "#0F172A", letterSpacing: -0.5 },
  sub: { color: "#475569", marginTop: 4, marginBottom: 18, fontSize: 14 },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#DC2626", letterSpacing: 1, textTransform: "uppercase" },
  label: { fontSize: 12, fontWeight: "600", color: "#475569", marginBottom: 6, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.3 },
  helperText: { fontSize: 12, color: "#64748B", marginTop: 6 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: "#0F172A" },
  bgRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6, marginBottom: 6 },
  bgChip: { borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "#fff", borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  bgChipActive: { backgroundColor: "#DC2626", borderColor: "#DC2626" },
  bgChipText: { fontWeight: "700", color: "#475569" },
  bgChipTextActive: { color: "#fff" },
  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, marginBottom: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: "#CBD5E1", backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkboxOn: { backgroundColor: "#DC2626", borderColor: "#DC2626" },
  termsText: { flex: 1, color: "#475569", fontSize: 13, lineHeight: 19 },
  termsLink: { color: "#DC2626", fontWeight: "700", textDecorationLine: "underline" },
  primaryBtn: { backgroundColor: "#DC2626", borderRadius: 14, paddingVertical: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  complaintBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#fff" },
  complaintBtnText: { color: "#475569", fontWeight: "700", fontSize: 14 },
});
