import React, { useMemo, useState } from "react";
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, TextInput, ScrollView, FlatList,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type Props = {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  searchable?: boolean;
  testID?: string;
  disabled?: boolean;
};

export default function SelectPicker({
  label, value, options, onChange, placeholder, searchable, testID, disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q) return options;
    const s = q.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(s));
  }, [q, options]);

  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.input, disabled && { opacity: 0.5 }]}
        onPress={() => { if (!disabled) { setQ(""); setOpen(true); } }}
        activeOpacity={0.8}
        testID={testID}
      >
        <Text style={[styles.inputText, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder || "Select"}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color="#64748B" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />
            <Text style={styles.title}>{label}</Text>

            {searchable && (
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={`Search ${label.toLowerCase()}...`}
                placeholderTextColor="#94A3B8"
                style={styles.search}
                autoFocus
                testID={`${testID}-search`}
              />
            )}

            <FlatList
              data={filtered}
              keyExtractor={(x) => x}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 420 }}
              renderItem={({ item }) => {
                const active = item === value;
                return (
                  <TouchableOpacity
                    style={[styles.row, active && styles.rowActive]}
                    onPress={() => { onChange(item); setOpen(false); }}
                    testID={`${testID}-opt-${item}`}
                  >
                    <Text style={[styles.rowText, active && { color: "#DC2626", fontWeight: "700" }]}>{item}</Text>
                    {active && <MaterialCommunityIcons name="check" size={18} color="#DC2626" />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={{ textAlign: "center", padding: 30, color: "#94A3B8" }}>No results</Text>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: "600", color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 },
  input: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center",
  },
  inputText: { flex: 1, fontSize: 16, color: "#0F172A", fontWeight: "500" },
  placeholder: { color: "#94A3B8", fontWeight: "400" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30, maxHeight: "80%" },
  handle: { width: 40, height: 4, backgroundColor: "#CBD5E1", borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  title: { fontSize: 17, fontWeight: "800", color: "#0F172A", marginBottom: 12 },
  search: {
    backgroundColor: "#F1F5F9", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: "#0F172A", marginBottom: 10,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  rowActive: {},
  rowText: { fontSize: 15, color: "#0F172A", fontWeight: "500" },
});
