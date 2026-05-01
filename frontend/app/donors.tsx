import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, Linking, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import SelectPicker from "../components/SelectPicker";
import { INDIAN_STATES, INDIA_STATES_CITIES, BLOOD_GROUPS } from "../data/indiaStatesCities";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
const MIN_SELECT = 5;

type Donor = { id: string; name: string; phone: string; blood_group: string; city: string; state: string; status: string };
type BloodReq = {
  patient_name: string; blood_group: string; hospital: string;
  hospital_city?: string; hospital_phone?: string; units: number;
  attender_name: string; attender_phone: string;
};

export default function DonorsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bg?: string; state?: string }>();
  const [req, setReq] = useState<BloodReq | null>(null);
  const [state, setState] = useState<string>("Tamil Nadu");
  const [city, setCity] = useState<string>("");
  const [bg, setBg] = useState<string>("");
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, Donor>>({});
  const [sending, setSending] = useState(false);
  const posterRef = useRef<ViewShot>(null);

  const cities = INDIA_STATES_CITIES[state] || [];

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem("current_request");
      if (!raw) {
        Alert.alert("No request", "Create a blood request first");
        router.replace("/home"); return;
      }
      const r: BloodReq = JSON.parse(raw);
      setReq(r);
      setBg(params.bg || r.blood_group);
      setState(params.state || "Tamil Nadu");
    })();
  }, []);

  useEffect(() => {
    if (!state || !city || !bg) {
      setDonors([]);
      return;
    }
    search();
  }, [state, city, bg]);

  const search = async () => {
    setLoading(true); setSelected({});
    try {
      const parts = [
        state ? `state=${encodeURIComponent(state)}` : "",
        city ? `city=${encodeURIComponent(city)}` : "",
        bg ? `blood_group=${encodeURIComponent(bg)}` : "",
      ].filter(Boolean);
      const url = `${BACKEND}/api/donors?${parts.join("&")}`;
      const res = await fetch(url);
      const data = await res.json();
      setDonors(data.donors || []);
    } catch { Alert.alert("Error", "Could not load donors"); }
    finally { setLoading(false); }
  };

  const toggleSelect = (d: Donor) => {
    setSelected((cur) => {
      const n = { ...cur };
      if (n[d.id]) delete n[d.id]; else n[d.id] = d;
      return n;
    });
  };

  const selectedCount = Object.keys(selected).length;

  const messageText = useMemo(() => {
    if (!req) return "";
    return (
      `Your Blood Saves Many Lives — Donate Today, Be a Hero\n\n` +
      `🩸 URGENT BLOOD REQUEST\n` +
      `— Vallalar's Friends Blood Support —\n\n` +
      `Patient Name: ${req.patient_name}\n` +
      `Blood Group Required: ${req.blood_group}\n` +
      `Hospital: ${req.hospital}\n` +
      (req.hospital_city ? `Hospital City: ${req.hospital_city}\n` : ``) +
      (req.hospital_phone ? `Hospital/Blood Bank Phone: ${req.hospital_phone}\n` : ``) +
      `Units Required: ${req.units} Unit${req.units > 1 ? "s" : ""}\n\n` +
      `Please contact:\n` +
      `Attender: ${req.attender_name}\n` +
      `Phone: ${req.attender_phone}\n\n` +
      `Kindly help if you are able to donate. Thank you.`
    );
  }, [req]);

  const openWhatsApp = async (phone: string, text: string) => {
    const clean = phone.replace(/\D/g, "");
    const withCc = clean.length === 10 ? `91${clean}` : clean;
    const url = `whatsapp://send?phone=${withCc}&text=${encodeURIComponent(text)}`;
    const webUrl = `https://wa.me/${withCc}?text=${encodeURIComponent(text)}`;
    const can = await Linking.canOpenURL(url);
    await Linking.openURL(can ? url : webUrl);
  };

  const capturePoster = async (): Promise<string | null> => {
    try {
      if (!posterRef.current || !posterRef.current.capture) return null;
      const uri = await posterRef.current.capture();
      return uri || null;
    } catch { return null; }
  };

  const savePoster = async () => {
    const uri = await capturePoster();
    if (!uri) { Alert.alert("Failed to create poster"); return; }
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType: "image/jpeg", dialogTitle: "Save/Share Poster" });
    }
  };

  const sendToSelected = async () => {
    if (selectedCount < MIN_SELECT) {
      Alert.alert("Select more donors", `Please select at least ${MIN_SELECT} donors.`);
      return;
    }
    setSending(true);
    try {
      // Fire-and-forget poster capture + share (non-blocking)
      capturePoster().then(async (uri) => {
        if (!uri) return;
        try {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(uri, { mimeType: "image/jpeg", dialogTitle: "Share Blood Request Poster" });
          }
        } catch {}
      });
      // Open WhatsApp chat for each donor sequentially
      await sendSequential();
    } finally {
      setSending(false);
    }
  };

  const sendSequential = async () => {
    const list = Object.values(selected);
    for (const d of list) {
      await openWhatsApp(d.phone, messageText);
      await new Promise((r) => setTimeout(r, 700));
    }
  };

  if (!req) return <SafeAreaView style={styles.safe}><ActivityIndicator style={{ marginTop: 40 }} color="#DC2626" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="donors-back-btn">
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Donors</Text>
        <TouchableOpacity onPress={savePoster} testID="preview-poster-btn">
          <MaterialCommunityIcons name="image-outline" size={22} color="#DC2626" />
        </TouchableOpacity>
      </View>

      <View style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sumPatient} numberOfLines={1}>{req.patient_name}</Text>
          <Text style={styles.sumMeta} numberOfLines={1}>
            {req.hospital} • {req.units} unit{req.units > 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.bgBadge}><Text style={styles.bgBadgeText}>{req.blood_group}</Text></View>
      </View>

      {/* Filters */}
      <View style={styles.filtersWrap}>
        <View style={{ flex: 1 }}>
          <SelectPicker label="State" value={state} options={INDIAN_STATES}
            onChange={(v) => { setState(v); setCity(""); }} searchable testID="filter-state" />
        </View>
        <View style={{ flex: 1 }}>
          <SelectPicker label="City" value={city} options={cities}
            onChange={(v) => setCity(v)} searchable placeholder="All cities"
            testID="filter-city" />
        </View>
        <View style={{ flex: 1 }}>
          <SelectPicker label="Blood" value={bg} options={BLOOD_GROUPS}
            onChange={setBg} testID="filter-bg" />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color="#DC2626" />
      ) : !city ? (
        <View style={styles.empty} testID="pick-city-hint">
          <MaterialCommunityIcons name="city-variant-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyText}>Please select a city to view donors.</Text>
          <Text style={styles.emptySub}>State: {state || "Not set"} · Blood: {bg || "Not set"}</Text>
        </View>
      ) : donors.length === 0 ? (
        <View style={styles.empty} testID="no-donors">
          <MaterialCommunityIcons name="account-search" size={48} color="#CBD5E1" />
          <Text style={styles.emptyText}>No donors found for this combination.</Text>
          <Text style={styles.emptySub}>Try different city, state or blood group.</Text>
        </View>
      ) : (
        <FlatList
          data={donors}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListHeaderComponent={<Text style={styles.countText}>{donors.length} donors available</Text>}
          renderItem={({ item }) => {
            const isSel = !!selected[item.id];
            return (
              <TouchableOpacity
                style={[styles.donorCard, isSel && styles.donorCardSel]}
                onPress={() => toggleSelect(item)}
                activeOpacity={0.8}
                testID={`donor-card-${item.id}`}
              >
                <View style={[styles.checkbox, isSel && styles.checkboxOn]}>
                  {isSel && <MaterialCommunityIcons name="check" size={16} color="#fff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.donorName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.donorMeta} numberOfLines={1}>{item.phone} • {item.city}</Text>
                </View>
                <View style={styles.smallBg}><Text style={styles.smallBgText}>{item.blood_group}</Text></View>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); openWhatsApp(item.phone, messageText); }}
                  style={styles.waBtn}
                  testID={`donor-wa-${item.id}`}
                >
                  <MaterialCommunityIcons name="whatsapp" size={22} color="#25D366" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <View style={styles.footer}>
        <View>
          <Text style={styles.footerCount} testID="selected-count">
            Selected: <Text style={{ color: "#DC2626" }}>{selectedCount}</Text> / Min {MIN_SELECT}
          </Text>
          <Text style={styles.footerHint}>
            {selectedCount >= MIN_SELECT ? "Ready to send" : `Select ${MIN_SELECT - selectedCount} more`}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, (selectedCount < MIN_SELECT || sending) && { opacity: 0.5 }]}
          disabled={selectedCount < MIN_SELECT || sending}
          onPress={sendToSelected}
          testID="send-whatsapp-btn"
        >
          {sending ? <ActivityIndicator color="#fff" /> : (
            <>
              <MaterialCommunityIcons name="whatsapp" size={20} color="#fff" />
              <Text style={styles.sendBtnText}>Send Request</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Off-screen poster */}
      <View style={styles.hidden} pointerEvents="none">
        <ViewShot ref={posterRef} options={{ format: "jpg", quality: 0.95, result: "tmpfile" }}>
          <Poster req={req} />
        </ViewShot>
      </View>
    </SafeAreaView>
  );
}

function Poster({ req }: { req: BloodReq }) {
  return (
    <View style={posterStyles.poster}>
      <View style={posterStyles.topBar}>
        <MaterialCommunityIcons name="water" size={22} color="#fff" />
        <Text style={posterStyles.topText}>URGENT BLOOD REQUEST</Text>
      </View>
      <View style={posterStyles.bgCircle}>
        <Text style={posterStyles.bgCircleText}>{req.blood_group}</Text>
        <Text style={posterStyles.bgCircleSub}>{req.units} Unit{req.units > 1 ? "s" : ""}</Text>
      </View>
      <View style={posterStyles.body}>
        <Row label="Patient" value={req.patient_name} />
        <Row label="Hospital" value={req.hospital} />
        {!!req.hospital_city && <Row label="City" value={req.hospital_city} />}
        {!!req.hospital_phone && <Row label="Blood Bank Ph." value={req.hospital_phone} />}
        <Row label="Attender" value={req.attender_name} />
        <Row label="Phone" value={req.attender_phone} />
      </View>
      <View style={posterStyles.footer}>
        <Text style={posterStyles.footerTitle}>Kindly help if you can donate.</Text>
        <Text style={posterStyles.footerSub}>Shared via Vallalar&apos;s Friends Blood Support</Text>
      </View>
    </View>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={posterStyles.row}>
      <Text style={posterStyles.rowLabel}>{label}</Text>
      <Text style={posterStyles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  summary: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#FEF2F2", borderBottomWidth: 1, borderBottomColor: "#FEE2E2" },
  sumPatient: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  sumMeta: { fontSize: 12, color: "#475569", marginTop: 2 },
  bgBadge: { backgroundColor: "#DC2626", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  bgBadgeText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  filtersWrap: { flexDirection: "row", gap: 8, padding: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  countText: { color: "#64748B", fontSize: 12, fontWeight: "700", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  donorCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  donorCardSel: { borderColor: "#DC2626", backgroundColor: "#FEF2F2" },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  checkboxOn: { backgroundColor: "#DC2626", borderColor: "#DC2626" },
  donorName: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  donorMeta: { fontSize: 12, color: "#64748B", marginTop: 2 },
  smallBg: { backgroundColor: "#FEE2E2", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  smallBgText: { color: "#DC2626", fontWeight: "800", fontSize: 12 },
  waBtn: { padding: 4 },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { color: "#475569", marginTop: 10, fontSize: 15, fontWeight: "600" },
  emptySub: { color: "#94A3B8", marginTop: 4, fontSize: 13 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingBottom: Platform.OS === "ios" ? 28 : 16 },
  footerCount: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  footerHint: { fontSize: 12, color: "#64748B", marginTop: 2 },
  sendBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#25D366", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  sendBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  hidden: { position: "absolute", left: -2000, top: -2000, width: 380, height: 620 },
});

const posterStyles = StyleSheet.create({
  poster: { width: 380, backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#FECACA" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#DC2626", paddingVertical: 14 },
  topText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.5 },
  bgCircle: { alignSelf: "center", marginTop: 18, width: 140, height: 140, borderRadius: 70, backgroundColor: "#FEF2F2", borderWidth: 4, borderColor: "#DC2626", alignItems: "center", justifyContent: "center" },
  bgCircleText: { fontSize: 48, fontWeight: "900", color: "#DC2626", letterSpacing: -2 },
  bgCircleSub: { fontSize: 13, color: "#7F1D1D", fontWeight: "700", marginTop: -4 },
  body: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 8 },
  row: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#FEE2E2" },
  rowLabel: { width: 90, color: "#7F1D1D", fontWeight: "700", fontSize: 13, textTransform: "uppercase" },
  rowValue: { flex: 1, color: "#0F172A", fontWeight: "700", fontSize: 14 },
  footer: { backgroundColor: "#FEF2F2", padding: 14, alignItems: "center" },
  footerTitle: { color: "#DC2626", fontWeight: "800", fontSize: 14 },
  footerSub: { color: "#94A3B8", fontSize: 11, marginTop: 4 },
});
