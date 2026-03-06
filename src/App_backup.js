import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "lending-tracker-data";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const today = () => new Date().toISOString().split("T")[0];

const calcInterest = (principal, rate, rateType, lentDate, paidDate) => {
  if (!rate || rate === 0) return 0;
  const from = new Date(lentDate);
  const to = paidDate ? new Date(paidDate) : new Date();
  const diffMs = to - from;
  if (diffMs <= 0) return 0;
  const days = diffMs / (1000 * 60 * 60 * 24);
  let periods = 0;
  if (rateType === "daily") periods = days;
  else if (rateType === "weekly") periods = days / 7;
  else if (rateType === "monthly") periods = days / 30;
  else if (rateType === "yearly") periods = days / 365;
  return Math.round((principal * rate * periods) / 100);
};

const COLORS = ["#e8b86d", "#7ec8a4", "#7ab3d4", "#e07d7d", "#b07de0", "#d4a96a", "#6dbde8"];
const getColor = (i) => COLORS[i % COLORS.length];

const emptyBorrower = { name: "", phone: "", note: "" };
const emptyLoan = { amount: "", rate: "", rateType: "monthly", date: today(), note: "" };
const emptyPayment = { amount: "", date: today(), note: "" };

export default function App() {
  const [borrowers, setBorrowers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [activeLoanId, setActiveLoanId] = useState(null);
  const [search, setSearch] = useState("");

  // ✅ Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setBorrowers(JSON.parse(saved));
    } catch {}
  }, []);

  // ✅ Save to localStorage
  const save = useCallback((data) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }, []);

  const updateBorrowers = (data) => { setBorrowers(data); save(data); };

  const getLoanSummary = (b) => {
    let totalLent = 0, totalReturned = 0, totalInterest = 0;
    (b.loans || []).forEach(loan => {
      totalLent += loan.amount;
      const interest = calcInterest(loan.amount, loan.rate, loan.rateType, loan.date);
      totalInterest += interest;
    });
    (b.payments || []).forEach(p => totalReturned += p.amount);
    return { totalLent, totalReturned, totalInterest, outstanding: totalLent + totalInterest - totalReturned };
  };

  const dashStats = () => {
    let totalOut = 0, totalBorrowers = borrowers.length, activeBorrowers = 0;
    borrowers.forEach(b => {
      const s = getLoanSummary(b);
      if (s.outstanding > 0) { totalOut += s.outstanding; activeBorrowers++; }
    });
    return { totalOut, totalBorrowers, activeBorrowers };
  };

  const openModal = (type, loanId = null) => {
    setActiveLoanId(loanId);
    if (type === "addBorrower") setForm({ ...emptyBorrower });
    else if (type === "addLoan") setForm({ ...emptyLoan });
    else if (type === "addPayment") setForm({ ...emptyPayment });
    setModal(type);
  };

  const closeModal = () => { setModal(null); setForm({}); setActiveLoanId(null); };

  const submitBorrower = () => {
    if (!form.name?.trim()) return;
    const nb = { id: Date.now(), ...form, loans: [], payments: [] };
    const updated = [...borrowers, nb];
    updateBorrowers(updated);
    closeModal();
  };

  const submitLoan = () => {
    if (!form.amount || isNaN(form.amount)) return;
    const loan = { id: Date.now(), amount: parseFloat(form.amount), rate: parseFloat(form.rate) || 0, rateType: form.rateType, date: form.date, note: form.note };
    const updated = borrowers.map(b => b.id === selected.id ? { ...b, loans: [...(b.loans || []), loan] } : b);
    updateBorrowers(updated);
    setSelected(updated.find(b => b.id === selected.id));
    closeModal();
  };

  const submitPayment = () => {
    if (!form.amount || isNaN(form.amount)) return;
    const payment = { id: Date.now(), amount: parseFloat(form.amount), date: form.date, note: form.note, loanId: activeLoanId };
    const updated = borrowers.map(b => b.id === selected.id ? { ...b, payments: [...(b.payments || []), payment] } : b);
    updateBorrowers(updated);
    setSelected(updated.find(b => b.id === selected.id));
    closeModal();
  };

  const deleteBorrower = (id) => {
    const updated = borrowers.filter(b => b.id !== id);
    updateBorrowers(updated);
    setView("dashboard"); setSelected(null);
  };

  const deleteLoan = (loanId) => {
    const updated = borrowers.map(b => b.id === selected.id ? { ...b, loans: b.loans.filter(l => l.id !== loanId) } : b);
    updateBorrowers(updated);
    setSelected(updated.find(b => b.id === selected.id));
  };

  const deletePayment = (payId) => {
    const updated = borrowers.map(b => b.id === selected.id ? { ...b, payments: b.payments.filter(p => p.id !== payId) } : b);
    updateBorrowers(updated);
    setSelected(updated.find(b => b.id === selected.id));
  };

  const filteredBorrowers = borrowers.filter(b => b.name.toLowerCase().includes(search.toLowerCase()) || (b.phone || "").includes(search));

  const stats = dashStats();

  const styles = {
    app: { minHeight: "100vh", background: "#0f0f14", color: "#e8e4dc", fontFamily: "'Georgia', serif", padding: "0" },
    header: { background: "#16161e", borderBottom: "1px solid #2a2a38", padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 },
    logo: { fontSize: "22px", fontWeight: "700", color: "#e8b86d", letterSpacing: "0.5px" },
    subtitle: { fontSize: "12px", color: "#666", marginTop: "2px", fontFamily: "monospace" },
    statBar: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px", padding: "24px 28px 0" },
    statCard: { background: "#16161e", border: "1px solid #2a2a38", borderRadius: "12px", padding: "20px 22px" },
    statLabel: { fontSize: "11px", color: "#888", letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "monospace" },
    statValue: { fontSize: "28px", fontWeight: "700", color: "#e8b86d", marginTop: "6px" },
    statSub: { fontSize: "12px", color: "#555", marginTop: "4px" },
    section: { padding: "24px 28px" },
    sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
    sectionTitle: { fontSize: "13px", color: "#888", letterSpacing: "2px", textTransform: "uppercase", fontFamily: "monospace" },
    btn: { background: "#e8b86d", color: "#0f0f14", border: "none", borderRadius: "8px", padding: "9px 18px", fontWeight: "700", cursor: "pointer", fontSize: "13px", fontFamily: "monospace", letterSpacing: "0.5px" },
    btnSm: { background: "transparent", color: "#e8b86d", border: "1px solid #e8b86d33", borderRadius: "6px", padding: "5px 12px", cursor: "pointer", fontSize: "12px", fontFamily: "monospace" },
    btnDanger: { background: "transparent", color: "#e07d7d", border: "1px solid #e07d7d33", borderRadius: "6px", padding: "5px 12px", cursor: "pointer", fontSize: "12px", fontFamily: "monospace" },
    card: { background: "#16161e", border: "1px solid #2a2a38", borderRadius: "12px", padding: "18px 20px", marginBottom: "12px", cursor: "pointer", transition: "border-color 0.2s" },
    tag: { display: "inline-block", padding: "2px 10px", borderRadius: "20px", fontSize: "11px", fontFamily: "monospace" },
    input: { background: "#1e1e2a", border: "1px solid #2a2a38", borderRadius: "8px", color: "#e8e4dc", padding: "10px 14px", fontSize: "14px", width: "100%", boxSizing: "border-box", fontFamily: "Georgia, serif", outline: "none" },
    label: { fontSize: "12px", color: "#888", fontFamily: "monospace", letterSpacing: "1px", display: "block", marginBottom: "6px" },
    modalOverlay: { position: "fixed", inset: 0, background: "#000000cc", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" },
    modalBox: { background: "#16161e", border: "1px solid #2a2a38", borderRadius: "16px", padding: "28px", width: "420px", maxWidth: "95vw" },
    modalTitle: { fontSize: "18px", fontWeight: "700", color: "#e8b86d", marginBottom: "22px" },
    divider: { height: "1px", background: "#2a2a38", margin: "20px 0" },
    backBtn: { background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "13px", fontFamily: "monospace", padding: "0", marginBottom: "20px", display: "flex", alignItems: "center", gap: "6px" },
    row: { display: "flex", gap: "12px", justifyContent: "space-between", alignItems: "center" },
    loanRow: { background: "#1a1a24", border: "1px solid #2a2a38", borderRadius: "10px", padding: "16px 18px", marginBottom: "10px" },
    payRow: { background: "#131318", border: "1px solid #2a2a38", borderRadius: "8px", padding: "12px 16px", marginBottom: "8px" },
    searchBox: { background: "#1e1e2a", border: "1px solid #2a2a38", borderRadius: "8px", color: "#e8e4dc", padding: "9px 14px", fontSize: "13px", width: "220px", fontFamily: "monospace", outline: "none" },
  };

  // DETAIL VIEW
  if (view === "detail" && selected) {
    const b = borrowers.find(x => x.id === selected.id) || selected;
    const sum = getLoanSummary(b);
    const colorIdx = borrowers.indexOf(b);

    return (
      <div style={styles.app}>
        <div style={styles.header}>
          <div>
            <div style={styles.logo}>💰 LendLedger</div>
            <div style={styles.subtitle}>Money Lending Tracker</div>
          </div>
        </div>
        <div style={styles.section}>
          <button style={styles.backBtn} onClick={() => { setView("dashboard"); setSelected(null); }}>
            ← Back to Dashboard
          </button>

          {/* Borrower Header */}
          <div style={{ ...styles.card, cursor: "default", borderLeft: `4px solid ${getColor(colorIdx)}` }}>
            <div style={styles.row}>
              <div>
                <div style={{ fontSize: "22px", fontWeight: "700", color: "#e8e4dc" }}>{b.name}</div>
                {b.phone && <div style={{ fontSize: "13px", color: "#888", marginTop: "4px", fontFamily: "monospace" }}>📞 {b.phone}</div>}
                {b.note && <div style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>{b.note}</div>}
              </div>
              <button style={styles.btnDanger} onClick={() => deleteBorrower(b.id)}>Delete Borrower</button>
            </div>
            <div style={styles.divider} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px" }}>
              {[
                { label: "Total Lent", value: formatCurrency(sum.totalLent), color: "#e8b86d" },
                { label: "Interest Due", value: formatCurrency(sum.totalInterest), color: "#7ab3d4" },
                { label: "Returned", value: formatCurrency(sum.totalReturned), color: "#7ec8a4" },
                { label: "Outstanding", value: formatCurrency(sum.outstanding), color: sum.outstanding > 0 ? "#e07d7d" : "#7ec8a4" },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "11px", color: "#666", fontFamily: "monospace", letterSpacing: "1px" }}>{s.label}</div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: s.color, marginTop: "4px" }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Loans */}
          <div style={styles.sectionHeader}>
            <div style={styles.sectionTitle}>Loans</div>
            <button style={styles.btn} onClick={() => openModal("addLoan")}>+ Add Loan</button>
          </div>

          {(b.loans || []).length === 0 && (
            <div style={{ color: "#555", fontFamily: "monospace", fontSize: "13px", padding: "16px 0" }}>No loans recorded yet.</div>
          )}

          {(b.loans || []).sort((a, z) => new Date(z.date) - new Date(a.date)).map(loan => {
            const interest = calcInterest(loan.amount, loan.rate, loan.rateType, loan.date);
            const loanPayments = (b.payments || []).filter(p => p.loanId === loan.id);
            const loanPaid = loanPayments.reduce((s, p) => s + p.amount, 0);
            const loanDue = loan.amount + interest - loanPaid;
            return (
              <div key={loan.id} style={styles.loanRow}>
                <div style={styles.row}>
                  <div>
                    <span style={{ fontSize: "18px", fontWeight: "700", color: "#e8b86d" }}>{formatCurrency(loan.amount)}</span>
                    {loan.rate > 0 && (
                      <span style={{ ...styles.tag, background: "#7ab3d422", color: "#7ab3d4", marginLeft: "10px" }}>
                        {loan.rate}% / {loan.rateType}
                      </span>
                    )}
                    {loan.rate === 0 && (
                      <span style={{ ...styles.tag, background: "#ffffff11", color: "#888", marginLeft: "10px" }}>No Interest</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button style={styles.btnSm} onClick={() => openModal("addPayment", loan.id)}>+ Payment</button>
                    <button style={styles.btnDanger} onClick={() => deleteLoan(loan.id)}>Delete</button>
                  </div>
                </div>
                <div style={{ fontSize: "12px", color: "#666", marginTop: "8px", fontFamily: "monospace" }}>
                  Lent on {formatDate(loan.date)}
                  {loan.rate > 0 && ` · Interest accrued: ${formatCurrency(interest)}`}
                  {loan.note && ` · ${loan.note}`}
                </div>
                <div style={{ display: "flex", gap: "20px", marginTop: "10px" }}>
                  <div style={{ fontSize: "13px", color: "#7ec8a4" }}>Paid: {formatCurrency(loanPaid)}</div>
                  <div style={{ fontSize: "13px", color: loanDue > 0 ? "#e07d7d" : "#7ec8a4", fontWeight: "700" }}>
                    Due: {formatCurrency(loanDue > 0 ? loanDue : 0)}
                    {loanDue <= 0 && " ✓ Cleared"}
                  </div>
                </div>

                {loanPayments.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <div style={{ fontSize: "11px", color: "#555", fontFamily: "monospace", letterSpacing: "1px", marginBottom: "6px" }}>PAYMENTS</div>
                    {loanPayments.sort((a, z) => new Date(z.date) - new Date(a.date)).map(p => (
                      <div key={p.id} style={{ ...styles.payRow, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ color: "#7ec8a4", fontWeight: "700" }}>{formatCurrency(p.amount)}</span>
                          <span style={{ color: "#555", fontSize: "12px", fontFamily: "monospace", marginLeft: "12px" }}>{formatDate(p.date)}</span>
                          {p.note && <span style={{ color: "#666", fontSize: "12px", marginLeft: "10px" }}>{p.note}</span>}
                        </div>
                        <button style={styles.btnDanger} onClick={() => deletePayment(p.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* General Payments */}
          <div style={{ marginTop: "24px" }}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionTitle}>General Payments</div>
              <button style={styles.btnSm} onClick={() => openModal("addPayment", null)}>+ General Payment</button>
            </div>
            {(b.payments || []).filter(p => !p.loanId).length === 0 && (
              <div style={{ color: "#555", fontFamily: "monospace", fontSize: "13px" }}>No general payments recorded.</div>
            )}
            {(b.payments || []).filter(p => !p.loanId).sort((a, z) => new Date(z.date) - new Date(a.date)).map(p => (
              <div key={p.id} style={{ ...styles.payRow, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ color: "#7ec8a4", fontWeight: "700" }}>{formatCurrency(p.amount)}</span>
                  <span style={{ color: "#555", fontSize: "12px", fontFamily: "monospace", marginLeft: "12px" }}>{formatDate(p.date)}</span>
                  {p.note && <span style={{ color: "#666", fontSize: "12px", marginLeft: "10px" }}>{p.note}</span>}
                </div>
                <button style={styles.btnDanger} onClick={() => deletePayment(p.id)}>✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* MODALS */}
        {modal && (
          <div style={styles.modalOverlay} onClick={closeModal}>
            <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
              {modal === "addLoan" && (
                <>
                  <div style={styles.modalTitle}>Add New Loan</div>
                  <label style={styles.label}>AMOUNT (₹)</label>
                  <input style={{ ...styles.input, marginBottom: "14px" }} type="number" placeholder="10000" value={form.amount || ""} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                    <div>
                      <label style={styles.label}>INTEREST RATE (%)</label>
                      <input style={styles.input} type="number" placeholder="0" value={form.rate || ""} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} />
                    </div>
                    <div>
                      <label style={styles.label}>RATE TYPE</label>
                      <select style={{ ...styles.input }} value={form.rateType} onChange={e => setForm(f => ({ ...f, rateType: e.target.value }))}>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                  </div>
                  <label style={styles.label}>DATE</label>
                  <input style={{ ...styles.input, marginBottom: "14px" }} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  <label style={styles.label}>NOTE (optional)</label>
                  <input style={{ ...styles.input, marginBottom: "22px" }} placeholder="Purpose, collateral, etc." value={form.note || ""} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button style={styles.btn} onClick={submitLoan}>Add Loan</button>
                    <button style={{ ...styles.btn, background: "#2a2a38", color: "#888" }} onClick={closeModal}>Cancel</button>
                  </div>
                </>
              )}
              {modal === "addPayment" && (
                <>
                  <div style={styles.modalTitle}>Record Payment</div>
                  <label style={styles.label}>AMOUNT RECEIVED (₹)</label>
                  <input style={{ ...styles.input, marginBottom: "14px" }} type="number" placeholder="5000" value={form.amount || ""} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                  <label style={styles.label}>DATE</label>
                  <input style={{ ...styles.input, marginBottom: "14px" }} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  <label style={styles.label}>NOTE (optional)</label>
                  <input style={{ ...styles.input, marginBottom: "22px" }} placeholder="Cash / UPI / etc." value={form.note || ""} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button style={styles.btn} onClick={submitPayment}>Record</button>
                    <button style={{ ...styles.btn, background: "#2a2a38", color: "#888" }} onClick={closeModal}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // DASHBOARD
  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <div>
          <div style={styles.logo}>💰 LendLedger</div>
          <div style={styles.subtitle}>Money Lending Tracker</div>
        </div>
        <button style={styles.btn} onClick={() => openModal("addBorrower")}>+ New Borrower</button>
      </div>

      {/* Stats */}
      <div style={styles.statBar}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Total Outstanding</div>
          <div style={styles.statValue}>{formatCurrency(stats.totalOut)}</div>
          <div style={styles.statSub}>across all borrowers</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Active Borrowers</div>
          <div style={{ ...styles.statValue, color: "#7ec8a4" }}>{stats.activeBorrowers}</div>
          <div style={styles.statSub}>with pending dues</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Total Borrowers</div>
          <div style={{ ...styles.statValue, color: "#7ab3d4" }}>{stats.totalBorrowers}</div>
          <div style={styles.statSub}>all time</div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionTitle}>Borrowers</div>
          <input style={styles.searchBox} placeholder="Search name or phone…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {filteredBorrowers.length === 0 && (
          <div style={{ color: "#555", fontFamily: "monospace", fontSize: "14px", padding: "32px 0", textAlign: "center" }}>
            {borrowers.length === 0 ? "No borrowers yet. Add your first borrower →" : "No results found."}
          </div>
        )}

        {filteredBorrowers.map((b, i) => {
          const sum = getLoanSummary(b);
          const colorIdx = borrowers.indexOf(b);
          return (
            <div
              key={b.id}
              style={{ ...styles.card, borderLeft: `4px solid ${getColor(colorIdx)}` }}
              onClick={() => { setSelected(b); setView("detail"); }}
              onMouseEnter={e => e.currentTarget.style.borderColor = getColor(colorIdx)}
              onMouseLeave={e => e.currentTarget.style.borderLeft = `4px solid ${getColor(colorIdx)}`}
            >
              <div style={styles.row}>
                <div>
                  <div style={{ fontSize: "17px", fontWeight: "700", color: "#e8e4dc" }}>{b.name}</div>
                  <div style={{ fontSize: "12px", color: "#555", fontFamily: "monospace", marginTop: "3px" }}>
                    {b.phone || "No phone"} · {(b.loans || []).length} loan(s)
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "11px", color: "#666", fontFamily: "monospace" }}>OUTSTANDING</div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: sum.outstanding > 0 ? "#e07d7d" : "#7ec8a4" }}>
                    {formatCurrency(sum.outstanding > 0 ? sum.outstanding : 0)}
                  </div>
                  {sum.outstanding <= 0 && sum.totalLent > 0 && (
                    <div style={{ fontSize: "11px", color: "#7ec8a4", fontFamily: "monospace" }}>✓ Cleared</div>
                  )}
                </div>
              </div>
              {sum.totalLent > 0 && (
                <div style={{ display: "flex", gap: "20px", marginTop: "12px" }}>
                  <div style={{ fontSize: "12px", color: "#888" }}>Lent: <span style={{ color: "#e8b86d" }}>{formatCurrency(sum.totalLent)}</span></div>
                  <div style={{ fontSize: "12px", color: "#888" }}>Interest: <span style={{ color: "#7ab3d4" }}>{formatCurrency(sum.totalInterest)}</span></div>
                  <div style={{ fontSize: "12px", color: "#888" }}>Returned: <span style={{ color: "#7ec8a4" }}>{formatCurrency(sum.totalReturned)}</span></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Borrower Modal */}
      {modal === "addBorrower" && (
        <div style={styles.modalOverlay} onClick={closeModal}>
          <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
            <div style={styles.modalTitle}>Add New Borrower</div>
            <label style={styles.label}>FULL NAME *</label>
            <input style={{ ...styles.input, marginBottom: "14px" }} placeholder="Raju Sharma" value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <label style={styles.label}>PHONE NUMBER</label>
            <input style={{ ...styles.input, marginBottom: "14px" }} placeholder="9876543210" value={form.phone || ""} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <label style={styles.label}>NOTE (optional)</label>
            <input style={{ ...styles.input, marginBottom: "22px" }} placeholder="Address, reference, etc." value={form.note || ""} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            <div style={{ display: "flex", gap: "12px" }}>
              <button style={styles.btn} onClick={submitBorrower}>Add Borrower</button>
              <button style={{ ...styles.btn, background: "#2a2a38", color: "#888" }} onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
