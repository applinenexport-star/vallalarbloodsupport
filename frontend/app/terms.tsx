import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const SECTIONS: { heading: string; content: string[] }[] = [
  {
    heading: "1. Purpose of the Application",
    content: [
      "This application is designed to help connect individuals who require blood with voluntary blood donors. The application only acts as a communication platform to help users share blood donation requests.",
      "The application does not guarantee the availability, eligibility, or response of any donor listed in the system.",
    ],
  },
  {
    heading: "2. User Responsibility",
    content: [
      "The user (including patient attenders and donors) is solely responsible for the information they provide and for how they use the application.",
      "Users must ensure that:",
      "• All information submitted is true and accurate.",
      "• The application is used only for genuine blood donation requirements.",
      "• The platform is used ethically and responsibly.",
      "Any misuse of the platform is strictly prohibited.",
    ],
  },
  {
    heading: "3. Ethical Use",
    content: [
      "Users agree to use this application only for legitimate and humanitarian purposes related to blood donation.",
      "The following activities are strictly prohibited:",
      "• Providing false medical emergencies.",
      "• Sending spam, harassment, or misleading messages to donors.",
      "• Using donor contact information for marketing, promotion, or unrelated communication.",
      "• Misrepresenting patient information or hospital details.",
    ],
  },
  {
    heading: "4. Donor Information",
    content: [
      "Donor details are shared only to assist in voluntary blood donation.",
      "Users must respect donor privacy and agree that:",
      "• Donor contact information must be used only for blood donation requests.",
      "• Donors should not be harassed or repeatedly contacted.",
      "• Donor participation is completely voluntary.",
      "The application does not guarantee that any donor will agree to donate blood.",
    ],
  },
  {
    heading: "5. Medical Responsibility",
    content: [
      "This application does not provide medical advice and does not verify medical eligibility of donors.",
      "It is the responsibility of:",
      "• The hospital",
      "• Medical professionals",
      "• The donor",
      "to determine whether blood donation is medically safe and appropriate.",
    ],
  },
  {
    heading: "6. Limitation of Liability",
    content: [
      "The developer, owner, or operators of this application shall not be responsible or liable for:",
      "• Any misuse of the application by users.",
      "• Incorrect or misleading information provided by users.",
      "• Any communication or interaction between donors and requesters.",
      "• Any medical complications arising from blood donation.",
      "All actions taken through this platform are done at the user's own risk and responsibility.",
    ],
  },
  {
    heading: "7. Illegal Activities",
    content: [
      "Any illegal use of this application, including fraud, harassment, or misuse of personal data, may result in:",
      "• Immediate suspension or permanent blocking of the user account.",
      "• Reporting to relevant authorities.",
      "• Legal action as permitted under applicable laws.",
    ],
  },
  {
    heading: "8. Privacy",
    content: [
      "Users agree that the contact details they provide may be shared with individuals involved in the blood donation request process.",
      "The application will take reasonable efforts to protect user data but cannot guarantee absolute security.",
    ],
  },
  {
    heading: "9. Modification of Terms",
    content: [
      "The developer reserves the right to update or modify these Terms and Conditions at any time without prior notice.",
      "Continued use of the application after changes indicates acceptance of the updated terms.",
    ],
  },
  {
    heading: "10. Acceptance of Terms",
    content: [
      "By using this application, you acknowledge that you have read, understood, and agreed to these Terms and Conditions.",
    ],
  },
];

export default function TermsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="terms-back-btn">
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms &amp; Conditions</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Terms and Conditions</Text>
        <Text style={styles.eff}>Effective Date: February 2026</Text>
        <Text style={styles.intro}>
          By using this application, you agree to comply with and be bound by the following Terms and Conditions.
          If you do not agree with these terms, please do not use this application.
        </Text>

        {SECTIONS.map((s) => (
          <View key={s.heading} style={styles.sec}>
            <Text style={styles.h2}>{s.heading}</Text>
            {s.content.map((p, i) => (
              <Text key={i} style={styles.p}>{p}</Text>
            ))}
          </View>
        ))}

        <View style={styles.agreeCard}>
          <MaterialCommunityIcons name="check-decagram" size={26} color="#DC2626" />
          <Text style={styles.agreeText}>
            ☑ I agree to the Terms and Conditions and will use this platform responsibly.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  scroll: { padding: 20 },
  title: { fontSize: 24, fontWeight: "800", color: "#0F172A", letterSpacing: -0.5 },
  eff: { fontSize: 13, color: "#64748B", marginTop: 4 },
  intro: { fontSize: 14, color: "#475569", marginTop: 14, lineHeight: 22 },
  sec: { marginTop: 22 },
  h2: { fontSize: 16, fontWeight: "800", color: "#0F172A", marginBottom: 8 },
  p: { fontSize: 14, color: "#334155", lineHeight: 22, marginBottom: 4 },
  agreeCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FEF2F2", borderRadius: 14, padding: 16, marginTop: 24, marginBottom: 30, borderWidth: 1, borderColor: "#FECACA" },
  agreeText: { flex: 1, color: "#7F1D1D", fontWeight: "700", fontSize: 14, lineHeight: 20 },
});
