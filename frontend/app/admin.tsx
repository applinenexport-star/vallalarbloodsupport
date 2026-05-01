import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  ScrollView, FlatList, KeyboardAvoidingView, Platform, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

type Tab = "upload" | "block" | "complaints" | "pending" | "admins";

export default function AdminScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("upload");

  useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem("admin_jwt");
      if (!t) return;
      setToken(t);
      try {
        const res = await fetch(`${BACKEND}/api/admin/auth/me`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (res.ok) setMe(await res.json());
        else {
          await AsyncStorage.removeItem("admin_jwt");
          setToken("");
        }
      } catch {}
    })();
  }, []);

  const login = async () => {
    if (!email || !password) { Alert.alert("Enter email and password"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/admin/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed");
      await AsyncStorage.setItem("admin_jwt", data.token);
      setToken(data.token); setMe(data.admin); setPassword("");
    } catch (e: any) {
      Alert.alert("Login failed", e.message || "Invalid email or password");
    } finally { setLoading(false); }
  };

  const logout = async () => {
    await AsyncStorage.removeItem("admin_jwt");
    setToken(""); setMe(null); setEmail(""); setPassword("");
  };

  if (!token || !me) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} testID="admin-back-btn">
              <MaterialCommunityIcons name="arrow-left" size={22} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Admin Login</Text>
            <View style={{ width: 22 }} />
          </View>
          <ScrollView contentContainerStyle={styles.loginBox} keyboardShouldPersistTaps="handled">
            <MaterialCommunityIcons name="shield-lock" size={56} color="#DC2626" />
            <Text style={styles.h1}>Admin Login</Text>
            <Text style={styles.sub}>Enter your admin email and password.</Text>
            <TextInput
              value={email} onChangeText={setEmail}
              placeholder="Email" placeholderTextColor="#94A3B8"
              keyboardType="email-address" autoCapitalize="none"
              style={styles.loginInput} testID="admin-email-input"
            />
            <TextInput
              value={password} onChangeText={setPassword}
              placeholder="Password" placeholderTextColor="#94A3B8"
              secureTextEntry
              style={styles.loginInput} testID="admin-password-input"
            />
            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={login} disabled={loading}
              testID="admin-login-btn"
            >
              {loading ? <ActivityIndicator color="#fff" /> :
                <Text style={styles.primaryBtnText}>Login</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const isSuper = me.role === "super_admin";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.headerTitle}>Admin · {isSuper ? "Super" : "Admin"}</Text>
          <Text style={styles.headerSub}>{me.email}</Text>
        </View>
        <TouchableOpacity onPress={logout} testID="admin-logout-btn">
          <MaterialCommunityIcons name="logout" size={22} color="#64748B" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={{ paddingHorizontal: 8 }}>
        {(["upload", "block", "complaints", "pending", ...(isSuper ? ["admins" as const] : [])] as Tab[]).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)} testID={`admin-tab-${t}`}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "upload" ? "Donors" : t === "block" ? "Block" : t === "complaints" ? "Complaints" : t === "pending" ? "Pending" : "Admins"}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {tab === "upload" && <UploadTab token={token} />}
      {tab === "block" && <BlockTab token={token} />}
      {tab === "complaints" && <ComplaintsTab token={token} />}
      {tab === "pending" && <PendingTab token={token} />}
      {tab === "admins" && isSuper && <AdminsTab token={token} />}
    </SafeAreaView>
  );
}

// ---------- Upload / Sheet Sync Tab ----------
function UploadTab({ token }: { token: string }) {
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [last, setLast] = useState<number | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string>("");

  useEffect(() => { (async () => {
    try {
      const r = await fetch(`${BACKEND}/api/admin/sheet-settings`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const d = await r.json();
        setSheetUrl(d.url || "");
        setLastSynced(d.last_synced || "");
      }
    } catch {}
  })(); }, [token]);

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return;
    setFile(res.assets[0]);
  };

  const uploadCsv = async () => {
    if (!file) return;
    setUploading(true); setLast(null);
    try {
      const form = new FormData();
      // @ts-ignore
      form.append("file", { uri: file.uri, name: file.name || "donors.csv", type: file.mimeType || "text/csv" } as any);
      const res = await fetch(`${BACKEND}/api/donors/upload-csv`, {
        method: "POST", body: form, headers: { Authorization: `Bearer ${token}` } as any,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setLast(data.inserted || 0); setFile(null);
      Alert.alert("Success", `Inserted ${data.inserted} donors.`);
    } catch (e: any) { Alert.alert("Upload failed", e.message); }
    finally { setUploading(false); }
  };

  const syncSheet = async () => {
    if (!sheetUrl.trim()) { Alert.alert("Enter Google Sheet URL"); return; }
    setSyncing(true);
    try {
      const res = await fetch(`${BACKEND}/api/donors/sync-sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sheet_url: sheetUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Sync failed");
      setLastSynced(new Date().toISOString());
      Alert.alert("Update Donors", `Imported ${data.inserted} donors from sheet.`);
    } catch (e: any) {
      Alert.alert("Sync failed", e.message || "Check the sheet URL and sharing permissions.");
    } finally { setSyncing(false); }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.h}>Update Donors from Google Sheet</Text>
        <Text style={styles.p}>
          Paste a Google Sheet share link. Sheet must be set to &quot;Anyone with the link → Viewer&quot;.
          Required columns: <Text style={styles.mono}>Doners Name, Phone no, Blood group, City</Text> (State optional).
        </Text>
        <TextInput
          value={sheetUrl} onChangeText={setSheetUrl}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          placeholderTextColor="#94A3B8" autoCapitalize="none"
          style={styles.input} testID="sheet-url-input"
        />
        <TouchableOpacity
          style={[styles.primaryBtn, syncing && { opacity: 0.5 }]}
          disabled={syncing} onPress={syncSheet}
          testID="update-donors-btn"
        >
          {syncing ? <ActivityIndicator color="#fff" /> : (
            <><MaterialCommunityIcons name="cloud-sync" size={18} color="#fff" /><Text style={styles.primaryBtnText}>Update Donors</Text></>
          )}
        </TouchableOpacity>
        {!!lastSynced && <Text style={styles.note}>Last synced: {lastSynced.slice(0, 19).replace("T", " ")} UTC</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.h}>Bulk Upload (CSV File)</Text>
        <Text style={styles.p}>Alternative: upload a .csv file directly.</Text>
        <TouchableOpacity style={styles.pickBtn} onPress={pick} testID="pick-csv-btn">
          <MaterialCommunityIcons name="file-document-outline" size={22} color="#DC2626" />
          <Text style={styles.pickBtnText}>{file ? "Change file" : "Pick CSV file"}</Text>
        </TouchableOpacity>
        {file && (
          <View style={styles.fileCard}>
            <MaterialCommunityIcons name="file-check" size={20} color="#10B981" />
            <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
          </View>
        )}
        <TouchableOpacity style={[styles.primaryBtn, (!file || uploading) && { opacity: 0.5 }]} disabled={!file || uploading} onPress={uploadCsv} testID="upload-csv-btn">
          {uploading ? <ActivityIndicator color="#fff" /> : (
            <><MaterialCommunityIcons name="cloud-upload" size={20} color="#fff" /><Text style={styles.primaryBtnText}>Upload CSV</Text></>
          )}
        </TouchableOpacity>
        {last !== null && <Text style={styles.success}>✓ Inserted {last} donors</Text>}
      </View>
    </ScrollView>
  );
}

// ---------- Block Tab ----------
function BlockTab({ token }: { token: string }) {
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    try {
      const res = await fetch(`${BACKEND}/api/admin/blocklist`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setList(data.items || []);
    } catch {}
  };
  useEffect(() => { refresh(); }, []);

  const block = async () => {
    if (!phone.trim()) { Alert.alert("Enter phone"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/admin/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: phone.trim(), reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      setPhone(""); setReason(""); await refresh();
      Alert.alert("Blocked", `${data.phone_key} has been blocked.`);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); }
  };

  const unblock = async (p: string) => {
    await fetch(`${BACKEND}/api/admin/unblock`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ phone: p }),
    });
    await refresh();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.h}>Block a User</Text>
          <TextInput value={phone} onChangeText={setPhone} placeholder="10-digit phone" placeholderTextColor="#94A3B8"
            keyboardType="phone-pad" style={styles.input} testID="block-phone-input" />
          <TextInput value={reason} onChangeText={setReason} placeholder="Reason (optional)" placeholderTextColor="#94A3B8"
            style={styles.input} testID="block-reason-input" />
          <TouchableOpacity style={[styles.primaryBtn, loading && { opacity: 0.7 }]} onPress={block} disabled={loading} testID="block-btn">
            {loading ? <ActivityIndicator color="#fff" /> : (
              <><MaterialCommunityIcons name="account-cancel" size={18} color="#fff" /><Text style={styles.primaryBtnText}>Block User</Text></>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Blocked Phones ({list.length})</Text>
        {list.length === 0 ? <Text style={styles.empty}>No users blocked.</Text> :
          list.map((b, i) => (
            <View key={`${b.phone_key}-${i}`} style={styles.blockRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.blockPhone}>+91 {b.phone_key}</Text>
                {!!b.reason && <Text style={styles.blockReason}>{b.reason}</Text>}
              </View>
              <TouchableOpacity style={styles.unblockBtn} onPress={() => unblock(b.phone_key)}>
                <Text style={styles.unblockText}>Unblock</Text>
              </TouchableOpacity>
            </View>
          ))
        }
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------- Complaints Tab ----------
function ComplaintsTab({ token }: { token: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => {
    try {
      const res = await fetch(`${BACKEND}/api/admin/complaints`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setItems(data.items || []);
    } catch {}
    finally { setLoading(false); }
  })(); }, []);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color="#DC2626" />;
  if (items.length === 0) return <Text style={styles.empty}>No complaints yet.</Text>;

  return (
    <FlatList
      data={items} keyExtractor={(_, i) => String(i)}
      contentContainerStyle={{ padding: 16 }} ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item }) => (
        <View style={styles.complaintCard}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={styles.complaintName}>{item.name}</Text>
            <Text style={styles.complaintDate}>{(item.created_at || "").slice(0, 10)}</Text>
          </View>
          <Text style={styles.complaintPhone}>{item.phone}</Text>
          <Text style={styles.complaintDetails}>{item.details}</Text>
        </View>
      )}
    />
  );
}

// ---------- Pending Registrations Tab ----------
function PendingTab({ token }: { token: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/admin/pending-registrations`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setItems(data.items || []);
    } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const exportCsv = async () => {
    const url = `${BACKEND}/api/admin/pending-registrations/export`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch CSV");
      const text = await res.text();

      if (Platform.OS === "web") {
        // Browser download
        // @ts-ignore - Blob/document available on web
        const blob = new Blob([text], { type: "text/csv" });
        // @ts-ignore
        const href = URL.createObjectURL(blob);
        // @ts-ignore
        const a = document.createElement("a");
        a.href = href; a.download = "pending_donors.csv"; a.click();
        // @ts-ignore
        URL.revokeObjectURL(href);
        return;
      }

      // iOS / Android: write to cache then open share sheet
      const fileUri = `${FileSystem.cacheDirectory}pending_donors_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, text, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Saved", `CSV saved to:\n${fileUri}`);
        return;
      }
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Export Pending Donors",
        UTI: "public.comma-separated-values-text",
      });
    } catch (e: any) {
      Alert.alert("Export failed", e.message || "Try again");
    }
  };

  const markSynced = async () => {
    Alert.alert("Mark all as synced?", "Use this after you've added them to your Google Sheet.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mark Synced", style: "destructive",
        onPress: async () => {
          await fetch(`${BACKEND}/api/admin/pending-registrations/mark-synced`, {
            method: "POST", headers: { Authorization: `Bearer ${token}` },
          });
          await refresh();
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.pendingBar}>
        <Text style={styles.pendingBarText}>{items.length} pending registration{items.length === 1 ? "" : "s"}</Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <TouchableOpacity style={styles.smallBtn} onPress={exportCsv} testID="export-pending-btn" disabled={items.length === 0}>
            <MaterialCommunityIcons name="file-download" size={16} color="#fff" />
            <Text style={styles.smallBtnText}>Export CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: "#475569" }]} onPress={markSynced} disabled={items.length === 0} testID="mark-synced-btn">
            <MaterialCommunityIcons name="check-all" size={16} color="#fff" />
            <Text style={styles.smallBtnText}>Mark Synced</Text>
          </TouchableOpacity>
        </View>
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color="#DC2626" /> :
        items.length === 0 ? <Text style={styles.empty}>No pending registrations.</Text> :
        <FlatList
          data={items} keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 16 }} ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <View style={styles.complaintCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={styles.complaintName}>{item.name} · {item.blood_group}</Text>
                <Text style={styles.complaintDate}>{(item.registered_at || "").slice(0, 10)}</Text>
              </View>
              <Text style={styles.complaintPhone}>{item.phone} · age {item.age}</Text>
              <Text style={styles.complaintDetails}>
                {item.city}, {item.state}{item.town ? ` · ${item.town}` : ""}
                {item.diabetic ? ` · ${item.diabetic}` : ""}
              </Text>
            </View>
          )}
        />
      }
    </View>
  );
}

// ---------- Manage Admins Tab (super admin) ----------
function AdminsTab({ token }: { token: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    try {
      const res = await fetch(`${BACKEND}/api/admin/auth/list`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setList(data.items || []);
    } catch {}
  };
  useEffect(() => { refresh(); }, []);

  const invite = async () => {
    if (!email.trim() || password.length < 6) {
      Alert.alert("Invalid", "Email and a 6+ character password required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/admin/auth/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: email.trim(), password, name: name.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      setEmail(""); setPassword(""); setName("");
      await refresh();
      Alert.alert("Admin Created", `${data.email} can now log in.`);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); }
  };

  const remove = async (id: string, email: string) => {
    Alert.alert("Remove Admin?", `Revoke access for ${email}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          await fetch(`${BACKEND}/api/admin/auth/${id}`, {
            method: "DELETE", headers: { Authorization: `Bearer ${token}` },
          });
          await refresh();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.h}>Invite Admin</Text>
          <Text style={styles.p}>Create an admin account. They can log in with this email + password.</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#94A3B8"
            keyboardType="email-address" autoCapitalize="none" style={styles.input} testID="invite-email-input" />
          <TextInput value={password} onChangeText={setPassword} placeholder="Password (min 6 chars)" placeholderTextColor="#94A3B8"
            secureTextEntry style={styles.input} testID="invite-password-input" />
          <TextInput value={name} onChangeText={setName} placeholder="Name (optional)" placeholderTextColor="#94A3B8"
            style={styles.input} testID="invite-name-input" />
          <TouchableOpacity style={[styles.primaryBtn, loading && { opacity: 0.7 }]} onPress={invite} disabled={loading} testID="invite-admin-btn">
            {loading ? <ActivityIndicator color="#fff" /> : (
              <><MaterialCommunityIcons name="account-plus" size={18} color="#fff" /><Text style={styles.primaryBtnText}>Create Admin</Text></>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>All Admins ({list.length})</Text>
        {list.map((a) => (
          <View key={a.id} style={styles.blockRow} testID={`admin-row-${a.email}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.blockPhone}>{a.name || a.email}</Text>
              <Text style={styles.blockReason}>{a.email} · {a.role}</Text>
            </View>
            {a.role !== "super_admin" && (
              <TouchableOpacity style={[styles.unblockBtn, { backgroundColor: "#FEE2E2" }]} onPress={() => remove(a.id, a.email)}>
                <Text style={[styles.unblockText, { color: "#DC2626" }]}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  headerSub: { fontSize: 11, color: "#64748B", marginTop: 1 },
  loginBox: { padding: 30, alignItems: "center" },
  h1: { fontSize: 24, fontWeight: "800", color: "#0F172A", marginTop: 12 },
  sub: { color: "#475569", marginTop: 6, marginBottom: 20, textAlign: "center" },
  loginInput: { width: "100%", backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: "#0F172A", marginBottom: 12 },
  primaryBtn: { backgroundColor: "#DC2626", borderRadius: 14, paddingVertical: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, width: "100%" },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  tabsScroll: { maxHeight: 54, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  tab: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#DC2626" },
  tabText: { fontWeight: "700", color: "#64748B", fontSize: 13 },
  tabTextActive: { color: "#DC2626" },
  scroll: { padding: 16 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 14 },
  h: { fontSize: 14, fontWeight: "800", color: "#0F172A", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  p: { color: "#475569", fontSize: 13, marginBottom: 10, lineHeight: 19 },
  mono: { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 12, color: "#0F172A" },
  note: { fontSize: 12, color: "#64748B", marginTop: 10, textAlign: "center" },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#0F172A", marginBottom: 10 },
  pickBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#FEF2F2", borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: "#FECACA", borderStyle: "dashed", marginBottom: 10 },
  pickBtnText: { color: "#DC2626", fontWeight: "700", fontSize: 15 },
  fileCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, marginBottom: 10, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  fileName: { flex: 1, color: "#0F172A", fontWeight: "600" },
  success: { color: "#10B981", textAlign: "center", marginTop: 14, fontWeight: "700" },
  sectionTitle: { fontWeight: "800", color: "#0F172A", fontSize: 15, marginTop: 8, marginBottom: 10 },
  empty: { color: "#94A3B8", textAlign: "center", padding: 30 },
  blockRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  blockPhone: { fontWeight: "800", color: "#0F172A" },
  blockReason: { color: "#64748B", fontSize: 12, marginTop: 2 },
  unblockBtn: { backgroundColor: "#F1F5F9", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  unblockText: { color: "#0F172A", fontWeight: "700" },
  complaintCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  complaintName: { fontWeight: "800", color: "#0F172A" },
  complaintDate: { color: "#94A3B8", fontSize: 12 },
  complaintPhone: { color: "#475569", marginTop: 2, fontSize: 13 },
  complaintDetails: { color: "#334155", marginTop: 8, lineHeight: 20 },
  pendingBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, backgroundColor: "#FEF2F2", borderBottomWidth: 1, borderBottomColor: "#FEE2E2" },
  pendingBarText: { color: "#7F1D1D", fontWeight: "700", fontSize: 13 },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#DC2626", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  smallBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
