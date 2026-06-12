import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
  title: { fontSize: 18, marginBottom: 8, fontWeight: "bold" },
  section: { marginTop: 16, marginBottom: 8 },
  heading: { fontSize: 13, fontWeight: "bold", marginBottom: 6 },
  row: { marginBottom: 4 },
})

interface GroupReportData {
  title: string
  groupName: string
  total: string
  expenseCount: number
  budget: string
  settlements: { from: string; to: string; amount: string }[]
  expenses: { title: string; date: string; amount: string; paidBy: string }[]
}

export function GroupReportDocument({ data }: { data: GroupReportData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.row}>Group: {data.groupName}</Text>
        <Text style={styles.row}>Total: {data.total} · Budget: {data.budget}</Text>

        <View style={styles.section}>
          <Text style={styles.heading}>Outstanding Settlements</Text>
          {data.settlements.length === 0 ? (
            <Text style={styles.row}>All settled</Text>
          ) : (
            data.settlements.map((s, i) => (
              <Text key={i} style={styles.row}>
                {s.from} owes {s.to}: {s.amount}
              </Text>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Expenses ({data.expenseCount})</Text>
          {data.expenses.map((e, i) => (
            <Text key={i} style={styles.row}>
              {e.date} — {e.title} (paid by {e.paidBy}): {e.amount}
            </Text>
          ))}
        </View>
      </Page>
    </Document>
  )
}
