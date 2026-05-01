import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import SelectPicker from "../components/SelectPicker";
import { INDIAN_STATES, INDIA_STATES_CITIES, BLOOD_GROUPS } from "../data/indiaStatesCities";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function ProfileScreen() {
  const router = useRouter();
  const [donor, setDonor] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    (async () => {
      const p = (await AsyncStorage.getItem("auth_phone")) || "";
      setPhone(p);
      const raw = await AsyncStorage.getItem("donor_profile");
      if (raw) { setDonor(JSON.parse(raw)); return; }
      try {
        const res = await fetch(`${BACKEND}/api/donors/me?phone=${encodeURIComponent(p)}`);
        if (res.ok) {
          const d = await res.json();
          setDonor(d);
          await AsyncStorage.setItem("donor_profile", JSON.stringify(d));
        }
      } catch {}
    })();
  }, []);

  const update = (k: string, v: any) => setDonor((cur: any) => ({ ...cur, [k]: v }));

  const save = async () => {
    if (!donor) return;
    setSaving(true);
    try {
      const body = {
        name: donor.name, age: donor.age, blood_group: donor.blood_group,
        state: donor.state, city: donor.city, town: donor.town || null,
        diabetic: donor.diabetic || null, status: donor.status,
        last_donation_date: donor.last_donation_date || null,
        email: donor.email || null,
      };
      const res = await fetch(`${BACKEND}/api/donors/me?phone=${encodeURIComponent(phone)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      setDonor(data);
      await AsyncStorage.setItem("donor_profile", JSON.stringify(data));
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not save");
    } finally { setSaving(false); }
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(["auth_token", "auth_phone", "donor_profile", "current_request"]);
    router.replace("/");
  };

  const gotoHome = () => router.push("/home");

  if (!donor) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator style={{ marginTop: 40 }} color="#DC2626" /></SafeAreaView>;
  }

  const cities = INDIA_STATES_CITIES[donor.state] || [];
  const isAvailable = (donor.status || "Available") === "Available";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <MaterialCommunityIcons name="account-heart" size={22} color="#DC2626" />
            <Text style={styles.brand}>My Profile</Text>
          </View>
          <TouchableOpacity onPress={logout} testID="profile-logout-btn">
            <MaterialCommunityIcons name="logout" size={22} color="#64748B" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(donor.name || "?").charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.avatarName}>{donor.name}</Text>
              <Text style={styles.avatarSub}>{donor.blood_group} • {donor.city}, {donor.state}</Text>
              <View style={[styles.statusBadge, isAvailable ? styles.badgeOn : styles.badgeOff]}>
                <View style={[styles.dot, isAvailable ? { backgroundColor: "#10B981" } : { backgroundColor: "#94A3B8" }]} />
                <Text style={[styles.statusText, isAvailable ? { color: "#065F46" } : { color: "#475569" }]}>
                  {isAvailable ? "Available" : "Not Available"}
                </Text>
              </View>
            </View>
          </View>

          {/* Availability toggle */}
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionLabel}>Donation Availability</Text>
                <Text style={styles.helperText}>Turn off if you&apos;re currently unable to donate.</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, isAvailable ? styles.toggleOn : styles.toggleOff]}
                onPress={() => update("status", isAvailable ? "Not Available" : "Available")}
                testID="status-toggle"
              >
                <View style={[styles.thumb, isAvailable ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" }]} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Last Donation Date (YYYY-MM-DD)</Text>
            <TextInput
              value={donor.last_donation_date || ""}
              onChangeText={(v) => update("last_donation_date", v)}
              placeholder="e.g. 2025-12-20"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              testID="last-donation-date"
            />
            <Text style={styles.helperText}>
              You will be auto-hidden from donor searches for 5 months after this date.
            </Text>
          </View>

          {/* Details */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Personal Details</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput value={donor.name || ""} onChangeText={(v) => update("name", v)} style={styles.input} testID="profile-name" />
            <Text style={styles.label}>Age</Text>
            <TextInput
              value={String(donor.age || "")}
              onChangeText={(v) => update("age", parseInt(v.replace(/\D/g, ""), 10) || 0)}
              keyboardType="number-pad" maxLength={2}
              style={styles.input} testID="profile-age"
            />
            <Text style={styles.label}>Email</Text>
            <TextInput value={donor.email || ""} onChangeText={(v) => update("email", v)} style={styles.input} keyboardType="email-address" testID="profile-email" />
            <Text style={styles.label}>Blood Group</Text>
            <View style={styles.bgRow}>
              {BLOOD_GROUPS.map((g) => {
                const active = donor.blood_group === g;
                return (
                  <TouchableOpacity key={g} style={[styles.bgChip, active && styles.bgChipActive]} onPress={() => update("blood_group", g)} testID={`profile-bg-${g}`}>
                    <Text style={[styles.bgChipText, active && styles.bgChipTextActive]}>{g}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Location</Text>
            <SelectPicker
              label="State"
              value={donor.state || ""}
              options={INDIAN_STATES}
              onChange={(v) => { update("state", v); update("city", ""); }}
              searchable
              testID="profile-state"
            />
            <SelectPicker
              label="City"
              value={donor.city || ""}
              options={cities}
              onChange={(v) => update("city", v)}
              searchable
              testID="profile-city"
            />
            <Text style={styles.label}>Town / Village / Area</Text>
            <TextInput value={donor.town || ""} onChangeText={(v) => update("town", v)} style={styles.input} testID="profile-town" />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Health</Text>
            <Text style={styles.label}>Diabetic?</Text>
            <View style={styles.diabRow}>
              {["Non-Diabetic", "Diabetic"].map((opt) => {
                const active = donor.diabetic === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.diabChip, active && styles.diabChipActive]}
                    onPress={() => update("diabetic", active ? "" : opt)}
                    testID={`profile-diab-${opt}`}
                  >
                    <Text style={[styles.diabText, active && { color: "#fff" }]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, saving && { opacity: 0.7 }]}
            onPress={save}
            disabled={saving}
            testID="profile-save-btn"
          >
            {saving ? <ActivityIndicator color="#fff" /> : (
              <>
                <MaterialCommunityIcons name="content-save" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.outlineBtn} onPress={gotoHome} testID="goto-request-btn">
            <MaterialCommunityIcons name="water" size={18} color="#DC2626" />
            <Text style={styles.outlineBtnText}>Create a Blood Request</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E2E8F0", backgroundColor: "#fff" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  brand: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  scroll: { padding: 20, paddingBottom: 60 },
  avatarCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 26, fontWeight: "800" },
  avatarName: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  avatarSub: { color: "#475569", fontSize: 13, marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeOn: { backgroundColor: "#D1FAE5" }, badgeOff: { backgroundColor: "#E2E8F0" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "700" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#DC2626", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  label: { fontSize: 12, fontWeight: "600", color: "#475569", marginBottom: 6, marginTop: 10, textTransform: "uppercase", letterSpacing: 0.3 },
  helperText: { fontSize: 12, color: "#64748B", marginTop: 6 },
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
  toggle: { width: 54, height: 30, borderRadius: 16, padding: 3, justifyContent: "center" },
  toggleOn: { backgroundColor: "#10B981" }, toggleOff: { backgroundColor: "#CBD5E1" },
  thumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff" },
  primaryBtn: { backgroundColor: "#DC2626", borderRadius: 14, paddingVertical: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  outlineBtn: { marginTop: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#FECACA", backgroundColor: "#FEF2F2" },
  outlineBtnText: { color: "#DC2626", fontWeight: "700", fontSize: 14 },
});
