import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
  title: { fontSize: 18, marginBottom: 8, fontWeight: "bold" },
  section: { marginTop: 16, marginBottom: 8 },
  heading: { fontSize: 13, fontWeight: "bold", marginBottom: 6 },
  row: { marginBottom: 4 },
})

interface PersonalReportData {
  title: string
  total: string
  expenseCount: number
  categoryBreakdown: { name: string; amount: string }[]
  expenses: { title: string; date: string; category: string; amount: string }[]
}

export function PersonalReportDocument({
  data,
  userName,
}: {
  data: PersonalReportData
  userName: string
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.row}>User: {userName}</Text>
        <Text style={styles.row}>Total: {data.total} ({data.expenseCount} expenses)</Text>

        <View style={styles.section}>
          <Text style={styles.heading}>Category Breakdown</Text>
          {data.categoryBreakdown.map((c) => (
            <Text key={c.name} style={styles.row}>{c.name}: {c.amount}</Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Expenses</Text>
          {data.expenses.map((e, i) => (
            <Text key={i} style={styles.row}>
              {e.date} — {e.title} ({e.category}): {e.amount}
            </Text>
          ))}
        </View>
      </Page>
    </Document>
  )
}
