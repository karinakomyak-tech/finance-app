'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../lib/supabase'

/** -------------------- TYPES -------------------- */
type Transaction = {
  id: string
  date: string
  type: 'income' | 'expense'
  amount: number
  category: string
  taxable_usn: boolean | null
  note: string | null
  obligation_type: 'loan' | 'card' | 'recurring' | 'tax' | null
  obligation_id: string | null
  created_at: string
}

type Loan = {
  id: string
  title: string
  balance: number
  monthly_payment: number
  payment_day: number
  annual_rate: number | null
  last_payment_date: string | null
  active: boolean
  created_at: string
}

type LoanPayment = {
  id: string
  loan_id: string
  payment_date: string
  payment_amount: number
  interest_amount: number
  principal_amount: number
  balance_before: number
  balance_after: number
  created_at: string
}

type IpSettings = {
  id: string
  annual_fixed: number
  extra_rate: number
  created_at: string
}

type SavingsSettings = {
  id: string
  goal_amount: number
  target_monthly: number
  created_at: string
}

type SavingsEntry = {
  id: string
  date: string
  amount: number
  note: string | null
  created_at: string
}

type Carryover = {
  month: string
  carry_in: number
  created_at: string
}

type Recurring = {
  id: string
  title: string
  amount: number
  pay_day: number
  active: boolean
  created_at: string
}

type RecurringPayment = {
  id: string
  recurring_id: string
  month: string
  paid_date: string
  amount: number
  created_at: string
}

type CardAccount = {
  id: string
  title: string
  balance: number
  statement_day: number
  due_day: number
  min_payment_rate: number
  active: boolean
  created_at: string
}

type CardEvent = {
  id: string
  card_id: string
  date: string
  kind: 'interest' | 'payment'
  amount: number
  note: string | null
  created_at: string
}

type TaxPayment = {
  id: string
  date: string | null
  kind: 'usn6' | 'insurance' | 'extra1'
  amount: number
  note: string | null
  tx_id: string | null
  created_at: string
}

/** -------------------- HELPERS -------------------- */
function toDateOnly(d: Date) {
  return d.toISOString().slice(0, 10)
}

function toMonthKey(d: Date) {
  return d.toISOString().slice(0, 7) // YYYY-MM
}

function parseNumberLoose(input: string) {
  const cleaned = input.replace(',', '.').replace(/\s/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : NaN
}

function money(n: number) {
  const rounded = Math.round(n)
  return rounded.toLocaleString('ru-RU') + ' ₽'
}

function fmtDateTimeRu(iso: string) {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function clampDay(d: number) {
  return Math.min(28, Math.max(1, d))
}

function monthPrev(month: string) {
  const [y, m] = month.split('-').map(Number)
  const dt = new Date(y, m - 1, 1)
  dt.setMonth(dt.getMonth() - 1)
  return toMonthKey(dt)
}

function monthNext(month: string) {
  const [y, m] = month.split('-').map(Number)
  const dt = new Date(y, m - 1, 1)
  dt.setMonth(dt.getMonth() + 1)
  return toMonthKey(dt)
}

/** -------------------- UI -------------------- */
/**
 * ВАЖНО: чтобы React не ругался на mix shorthand/non-shorthand,
 * НЕ используем `border:` в стилях, а задаём borderWidth/borderStyle/borderColor.
 */
const ui = {
  page: {
    padding: 16,
    paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    maxWidth: 1120,
    margin: '0 auto',
    color: '#f3f3f3',
  } as CSSProperties,

  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'baseline',
  } as CSSProperties,

  h1: { fontSize: 24, fontWeight: 900, margin: 0 } as CSSProperties,
  sub: { opacity: 0.78, marginTop: 6 } as CSSProperties,

  grid: { display: 'grid', gap: 12, marginTop: 14 } as CSSProperties,

  cards: {
    display: 'grid',
    gap: 12,
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  } as CSSProperties,

  card: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    padding: 14,
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(6px)',
    minWidth: 0,
  } as CSSProperties,

  cardTitle: { fontWeight: 900, marginBottom: 10 } as CSSProperties,
  small: { fontSize: 12, opacity: 0.72 } as CSSProperties,

  row: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', minWidth: 0 } as CSSProperties,

  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.25)',
    color: '#f3f3f3',
    outline: 'none',
    boxSizing: 'border-box',
    fontSize: 16,
    lineHeight: '20px',
  } as CSSProperties,

  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.25)',
    color: '#f3f3f3',
    outline: 'none',
    boxSizing: 'border-box',
    fontSize: 16,
    lineHeight: '20px',
  } as CSSProperties,

  btn: {
    padding: '10px 12px',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.06)',
    color: '#f3f3f3',
    cursor: 'pointer',
    fontSize: 16,
  } as CSSProperties,

  btnPrimary: {
    padding: '10px 12px',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.25)',
    background: 'rgba(255,255,255,0.14)',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: 16,
  } as CSSProperties,

  divider: { height: 1, background: 'rgba(255,255,255,0.08)', margin: '10px 0' } as CSSProperties,

  pill: {
    display: 'inline-flex',
    gap: 8,
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    fontSize: 12,
    opacity: 0.95,
    minWidth: 0,
  } as CSSProperties,

  /** sidebar */
  topBar: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 6,
  } as CSSProperties,

  sidebarOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    zIndex: 50,
  } as CSSProperties,

  sidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100%',
    width: 290,
    padding: 14,
    background: 'rgba(15,15,15,0.98)',
    borderRightWidth: 1,
    borderRightStyle: 'solid',
    borderRightColor: 'rgba(255,255,255,0.10)',
    zIndex: 51,
    transform: 'translateX(-100%)',
    transition: 'transform 180ms ease',
    overflowY: 'auto',
  } as CSSProperties,

  sidebarOpen: {
    transform: 'translateX(0)',
  } as CSSProperties,

  navBtn: {
    width: '100%',
    textAlign: 'left',
    padding: '10px 12px',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#f3f3f3',
    cursor: 'pointer',
    fontSize: 16,
  } as CSSProperties,

  navBtnActive: {
    borderColor: 'rgba(255,255,255,0.35)',
    background: 'rgba(255,255,255,0.12)',
  } as CSSProperties,
}

/** -------------------- PAGE -------------------- */
export default function Home() {
  const today = toDateOnly(new Date())
  const now = new Date()

  /** month mode */
  const [month, setMonth] = useState<string>(toMonthKey(now)) // YYYY-MM

  /** sidebar tabs */
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'summary' | 'constant' | 'taxes' | 'savings' | 'add' | 'ops'>('summary')

  /** data */
  const [rows, setRows] = useState<Transaction[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [loanPayments, setLoanPayments] = useState<Record<string, LoanPayment[]>>({})
  const [ipSettings, setIpSettings] = useState<IpSettings | null>(null)
  const [savingsSettings, setSavingsSettings] = useState<SavingsSettings | null>(null)
  const [savingsEntries, setSavingsEntries] = useState<SavingsEntry[]>([])
  const [carry, setCarry] = useState<Carryover | null>(null)
  const [recurrings, setRecurrings] = useState<Recurring[]>([])
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([])
  const [cards, setCards] = useState<CardAccount[]>([])
  const [cardEvents, setCardEvents] = useState<CardEvent[]>([])
  const [taxPayments, setTaxPayments] = useState<TaxPayment[]>([])
  const [loading, setLoading] = useState(false)

  /** forms */
  const [incomeDate, setIncomeDate] = useState(today)
  const [incomeAmount, setIncomeAmount] = useState('')
  const [incomeCategory, setIncomeCategory] = useState('Основной доход')
  const [incomeTaxable, setIncomeTaxable] = useState(true)
  const [incomeNote, setIncomeNote] = useState('')

  const [expenseDate, setExpenseDate] = useState(today)
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('Еда')
  const [expenseNote, setExpenseNote] = useState('')

  const [loanTitle, setLoanTitle] = useState('')
  const [loanBalance, setLoanBalance] = useState('')
  const [loanMonthly, setLoanMonthly] = useState('')
  const [loanDay, setLoanDay] = useState('10')
  const [loanRate, setLoanRate] = useState('24')

  const [payLoanId, setPayLoanId] = useState<string>('')
  const [payLoanDate, setPayLoanDate] = useState(today)
  const [payLoanAmount, setPayLoanAmount] = useState('')

  // savings
  const [goalInput, setGoalInput] = useState('1000000')
  const [targetMonthlyInput, setTargetMonthlyInput] = useState('0')
  const [saveDate, setSaveDate] = useState(today)
  const [saveAmount, setSaveAmount] = useState('')
  const [saveNote, setSaveNote] = useState('')

  // recurring
  const [recTitle, setRecTitle] = useState('')
  const [recAmount, setRecAmount] = useState('')
  const [recDay, setRecDay] = useState('1')

  // card add
  const [cardTitle, setCardTitle] = useState('')
  const [cardBalance, setCardBalance] = useState('')
  const [cardStatementDay, setCardStatementDay] = useState('1')
  const [cardDueDay, setCardDueDay] = useState('10')
  const [cardMinRate, setCardMinRate] = useState('0.05')

  // card actions
  const [payCardId, setPayCardId] = useState('')
  const [payCardDate, setPayCardDate] = useState(today)
  const [payCardAmount, setPayCardAmount] = useState('')
  const [addCardInterestId, setAddCardInterestId] = useState('')
  const [addCardInterestDate, setAddCardInterestDate] = useState(today)
  const [addCardInterestAmount, setAddCardInterestAmount] = useState('')

  // taxes actions (you input)
  const [taxDate, setTaxDate] = useState(today)
  const [taxKind, setTaxKind] = useState<'usn6' | 'insurance' | 'extra1'>('insurance')
  const [taxAmount, setTaxAmount] = useState('')
  const [taxNote, setTaxNote] = useState('')

  // edit transactions
  const [editingTxId, setEditingTxId] = useState<string>('')
  const [txEditDate, setTxEditDate] = useState(today)
  const [txEditAmount, setTxEditAmount] = useState('')
  const [txEditCategory, setTxEditCategory] = useState('')
  const [txEditNote, setTxEditNote] = useState('')
  const [txEditTaxable, setTxEditTaxable] = useState(false)

  /** -------------------- LOADERS -------------------- */
  async function loadTransactions() {
    const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false }).limit(1500)
    if (error) return alert('transactions: ' + error.message)
    setRows((data as Transaction[]) || [])
  }

  async function loadLoans() {
    const { data, error } = await supabase.from('loans').select('*').order('created_at', { ascending: false })
    if (error) return alert('loans: ' + error.message)
    setLoans((data as Loan[]) || [])
  }

  async function loadLoanPayments() {
    const { data, error } = await supabase.from('loan_payments').select('*').order('payment_date', { ascending: false }).limit(1500)
    if (error) return alert('loan_payments: ' + error.message)

    const grouped: Record<string, LoanPayment[]> = {}
    for (const p of (data as LoanPayment[]) || []) {
      if (!grouped[p.loan_id]) grouped[p.loan_id] = []
      grouped[p.loan_id].push(p)
    }
    setLoanPayments(grouped)
  }

  async function ensureIpSettingsRow() {
    const { data, error } = await supabase.from('ip_settings').select('*').order('created_at', { ascending: false }).limit(1)
    if (error) return alert('ip_settings: ' + error.message)
    const row = (data as IpSettings[] | null)?.[0] ?? null
    if (row) {
      setIpSettings(row)
      return
    }
    const { data: insData, error: insErr } = await supabase
      .from('ip_settings')
      .insert({ annual_fixed: 0, extra_rate: 0.01 })
      .select('*')
      .single()
    if (insErr) return alert('ip_settings insert: ' + insErr.message)
    setIpSettings(insData as IpSettings)
  }

  async function ensureSavingsSettingsRow() {
    const { data, error } = await supabase.from('savings_settings').select('*').order('created_at', { ascending: false }).limit(1)
    if (error) return alert('savings_settings: ' + error.message)

    const row = (data as SavingsSettings[] | null)?.[0] ?? null
    if (row) {
      setSavingsSettings(row)
      setGoalInput(String(row.goal_amount ?? 1000000))
      setTargetMonthlyInput(String(row.target_monthly ?? 0))
      return
    }

    const { data: insData, error: insErr } = await supabase
      .from('savings_settings')
      .insert({ goal_amount: 1000000, target_monthly: 0 })
      .select('*')
      .single()

    if (insErr) return alert('savings_settings insert: ' + insErr.message)
    setSavingsSettings(insData as SavingsSettings)
    setGoalInput(String((insData as SavingsSettings).goal_amount))
    setTargetMonthlyInput(String((insData as SavingsSettings).target_monthly))
  }

  async function loadSavingsEntries() {
    const { data, error } = await supabase.from('savings_entries').select('*').order('date', { ascending: false }).limit(2000)
    if (error) return alert('savings_entries: ' + error.message)
    setSavingsEntries((data as SavingsEntry[]) || [])
  }

  async function loadCarryover() {
    const { data, error } = await supabase.from('month_carryovers').select('*').eq('month', month).maybeSingle()
    if (error) return alert('month_carryovers: ' + error.message)
    setCarry((data as Carryover) || null)
  }

  async function loadRecurring() {
    const { data, error } = await supabase.from('recurring_expenses').select('*').order('created_at', { ascending: false })
    if (error) return alert('recurring_expenses: ' + error.message)
    setRecurrings((data as Recurring[]) || [])
  }

  async function loadRecurringPayments() {
    const { data, error } = await supabase.from('recurring_payments').select('*').order('paid_date', { ascending: false }).limit(2000)
    if (error) return alert('recurring_payments: ' + error.message)
    setRecurringPayments((data as RecurringPayment[]) || [])
  }

  async function loadCards() {
    const { data, error } = await supabase.from('card_accounts').select('*').order('created_at', { ascending: false })
    if (error) return alert('card_accounts: ' + error.message)
    setCards((data as CardAccount[]) || [])
  }

  async function loadCardEvents() {
    const { data, error } = await supabase.from('card_events').select('*').order('date', { ascending: false }).limit(3000)
    if (error) return alert('card_events: ' + error.message)
    setCardEvents((data as CardEvent[]) || [])
  }

  async function loadTaxPayments() {
    // если date nullable — сортировка по date может вести себя странно, но оставляем, как ты хотела
    const { data, error } = await supabase
      .from('tax_payments')
      .select('*')
      .order('date', { ascending: false, nullsFirst: false })
      .limit(3000)
    if (error) return alert('tax_payments: ' + error.message)
    setTaxPayments((data as TaxPayment[]) || [])
  }

  async function loadAll() {
    setLoading(true)
    await Promise.all([
      loadTransactions(),
      loadLoans(),
      loadLoanPayments(),
      ensureIpSettingsRow(),
      ensureSavingsSettingsRow(),
      loadSavingsEntries(),
      loadCarryover(),
      loadRecurring(),
      loadRecurringPayments(),
      loadCards(),
      loadCardEvents(),
      loadTaxPayments(),
    ])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // reload carryover when month changes
  useEffect(() => {
    loadCarryover()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  /** Auto-realtime refresh */
  useEffect(() => {
    const ch = supabase
      .channel('finance_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => loadTransactions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => loadLoans())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_payments' }, () => loadLoanPayments())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_entries' }, () => loadSavingsEntries())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'month_carryovers' }, () => loadCarryover())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_expenses' }, () => loadRecurring())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_payments' }, () => loadRecurringPayments())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'card_accounts' }, () => loadCards())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'card_events' }, () => loadCardEvents())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tax_payments' }, () => loadTaxPayments())
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** -------------------- FILTERS BY MONTH -------------------- */
  const rowsMonth = useMemo(() => rows.filter(r => r.date.startsWith(month)), [rows, month])
  const savingsMonth = useMemo(() => savingsEntries.filter(s => s.date.startsWith(month)), [savingsEntries, month])

  const incomeMonth = useMemo(
    () => rowsMonth.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0),
    [rowsMonth]
  )

  const expenseMonth = useMemo(
    () => rowsMonth.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0),
    [rowsMonth]
  )

  const savedThisMonth = useMemo(
    () => savingsMonth.reduce((s, e) => s + Number(e.amount), 0),
    [savingsMonth]
  )

  const taxableIncomeYear = useMemo(() => {
    const y = month.slice(0, 4)
    return rows
      .filter(r => r.type === 'income' && r.taxable_usn === true && r.date.startsWith(y))
      .reduce((s, r) => s + Number(r.amount), 0)
  }, [rows, month])

  // резерв УСН 6% (в лимите трат учитываем как резерв)
  const taxableIncomeMonth = useMemo(
    () => rowsMonth.filter(r => r.type === 'income' && r.taxable_usn === true).reduce((s, r) => s + Number(r.amount), 0),
    [rowsMonth]
  )
  const usnReserve = taxableIncomeMonth * 0.06

  // carry_in for month
  const carryIn = Number(carry?.carry_in ?? 0)

  // ТЕКУЩИЙ РЕАЛЬНЫЙ ОСТАТОК
  const currentBalance = carryIn + incomeMonth - expenseMonth - savedThisMonth

  /** -------------------- COPYBANK -------------------- */
  const goal = Number(savingsSettings?.goal_amount ?? 1000000)
  const targetMonthly = Number(savingsSettings?.target_monthly ?? 0)
  const remainingSaveThisMonth = Math.max(0, targetMonthly - savedThisMonth)

  /** -------------------- DAILY LIMIT (ОТ ОСТАТКА) -------------------- */
  const [yy, mm] = month.split('-').map(Number)
  const daysInMonth = new Date(yy, mm, 0).getDate()

  const isCurrentMonth = month === toMonthKey(new Date())
  const dayOfMonth = isCurrentMonth ? new Date().getDate() : 1
  const daysLeft = Math.max(1, daysInMonth - dayOfMonth + 1)

  const availableToSpendFromToday = Math.max(0, currentBalance - remainingSaveThisMonth)
  const limitPerDayFromToday = availableToSpendFromToday / daysLeft

  /** -------------------- TAXES (AUTO DUE + MANUAL PAYMENTS) -------------------- */
  const thresholdYear = 300_000
  const extraRate = Number(ipSettings?.extra_rate ?? 0.01)
  const annualFixed = Number(ipSettings?.annual_fixed ?? 0)

  const extraBaseYear = Math.max(0, taxableIncomeYear - thresholdYear)
  const extraDueYear = extraBaseYear * extraRate
  const insuranceDueYear = annualFixed

  const year = month.slice(0, 4)

  // ✅ null-safe startsWith
  const paidInsuranceYear = taxPayments
    .filter(p => p.kind === 'insurance' && ((p.date ?? '').startsWith(year)))
    .reduce((s, p) => s + Number(p.amount), 0)

  const paidExtraYear = taxPayments
    .filter(p => p.kind === 'extra1' && ((p.date ?? '').startsWith(year)))
    .reduce((s, p) => s + Number(p.amount), 0)

  const paidUsnYear = taxPayments
    .filter(p => p.kind === 'usn6' && ((p.date ?? '').startsWith(year)))
    .reduce((s, p) => s + Number(p.amount), 0)

  const insuranceRemain = Math.max(0, insuranceDueYear - paidInsuranceYear)
  const extraRemain = Math.max(0, extraDueYear - paidExtraYear)

  // ✅ добавили: УСН к уплате и остаток
  const usnDueYear = taxableIncomeYear * 0.06
  const usnRemainYear = Math.max(0, usnDueYear - paidUsnYear)

  /** -------------------- OBLIGATIONS (CONSTANT EXPENSES) -------------------- */
  const recurringPaidThisMonthSet = useMemo(() => {
    const set = new Set<string>()
    recurringPayments.filter(p => p.month === month).forEach(p => set.add(p.recurring_id))
    return set
  }, [recurringPayments, month])

  const loansPaidThisMonthSet = useMemo(() => {
    const set = new Set<string>()
    const lp = Object.values(loanPayments).flat().filter(p => p.payment_date.startsWith(month))
    lp.forEach(p => set.add(p.loan_id))
    return set
  }, [loanPayments, month])

  const cardsPaidThisMonthSet = useMemo(() => {
    const set = new Set<string>()
    cardEvents.filter(e => e.kind === 'payment' && e.date.startsWith(month)).forEach(e => set.add(e.card_id))
    return set
  }, [cardEvents, month])

  /** -------------------- ACTIONS -------------------- */
  async function submitIncome(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseNumberLoose(incomeAmount)
    if (!Number.isFinite(amount) || amount <= 0) return alert('Некорректная сумма дохода')

    const { error } = await supabase.from('transactions').insert({
      date: incomeDate,
      type: 'income',
      amount,
      category: incomeCategory.trim() || 'Доход',
      taxable_usn: incomeTaxable,
      note: incomeNote.trim() ? incomeNote.trim() : null,
    })
    if (error) return alert(error.message)

    setIncomeAmount('')
    setIncomeNote('')
  }

  async function submitExpense(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseNumberLoose(expenseAmount)
    if (!Number.isFinite(amount) || amount <= 0) return alert('Некорректная сумма расхода')

    const { error } = await supabase.from('transactions').insert({
      date: expenseDate,
      type: 'expense',
      amount,
      category: expenseCategory.trim() || 'Расход',
      taxable_usn: null,
      note: expenseNote.trim() ? expenseNote.trim() : null,
    })
    if (error) return alert(error.message)

    setExpenseAmount('')
    setExpenseNote('')
  }

  async function submitLoan(e: React.FormEvent) {
    e.preventDefault()

    const title = loanTitle.trim()
    if (!title) return alert('Название кредита обязательно')

    const balance = parseNumberLoose(loanBalance)
    const monthly_payment = parseNumberLoose(loanMonthly)
    const payment_day = clampDay(Number(loanDay))
    const annual_rate = parseNumberLoose(loanRate)

    if (!Number.isFinite(balance) || balance <= 0) return alert('Некорректный остаток долга')
    if (!Number.isFinite(monthly_payment) || monthly_payment <= 0) return alert('Некорректный ежемесячный платёж')
    if (!Number.isFinite(annual_rate) || annual_rate < 0 || annual_rate > 200) return alert('Некорректная ставка')

    const { error } = await supabase.from('loans').insert({
      title,
      balance,
      monthly_payment,
      payment_day,
      annual_rate,
      active: true,
      last_payment_date: null,
    })
    if (error) return alert(error.message)

    setLoanTitle('')
    setLoanBalance('')
    setLoanMonthly('')
  }

  async function deleteLoan(loan: Loan) {
    const ok = confirm(`Удалить кредит "${loan.title}"?\nЭто удалит и историю платежей.`)
    if (!ok) return
    const { error } = await supabase.from('loans').delete().eq('id', loan.id)
    if (error) return alert(error.message)
  }

  async function submitLoanPayment(e: React.FormEvent) {
    e.preventDefault()
    const loan = loans.find(l => l.id === payLoanId)
    if (!loan) return alert('Выбери кредит')

    const payment_amount = parseNumberLoose(payLoanAmount)
    if (!Number.isFinite(payment_amount) || payment_amount <= 0) return alert('Некорректная сумма платежа')

    const annualRate = Number(loan.annual_rate ?? 0)
    const dailyRate = annualRate / 100 / 365

    const startDate = (loan.last_payment_date ?? loan.created_at.slice(0, 10)).slice(0, 10)
    const a = new Date(startDate + 'T00:00:00')
    const b = new Date(payLoanDate + 'T00:00:00')
    const days = Math.max(0, Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)))

    const balance_before = Number(loan.balance)
    const interest_amount = balance_before * dailyRate * days
    const principal_amount = Math.max(0, payment_amount - interest_amount)
    const balance_after = Math.max(0, balance_before - principal_amount)
    const active = balance_after > 0

    const { error: updErr } = await supabase
      .from('loans')
      .update({ balance: balance_after, active, last_payment_date: payLoanDate })
      .eq('id', loan.id)
    if (updErr) return alert(updErr.message)

    const { error: insErr } = await supabase.from('loan_payments').insert({
      loan_id: loan.id,
      payment_date: payLoanDate,
      payment_amount,
      interest_amount,
      principal_amount,
      balance_before,
      balance_after,
    })
    if (insErr) return alert(insErr.message)

    const { error: txErr } = await supabase.from('transactions').insert({
      date: payLoanDate,
      type: 'expense',
      amount: payment_amount,
      category: `Кредит: ${loan.title}`,
      taxable_usn: null,
      note: 'Платёж по кредиту',
      obligation_type: 'loan',
      obligation_id: loan.id,
    })
    if (txErr) return alert('Не удалось записать расход по кредиту: ' + txErr.message)

    setPayLoanAmount('')
    alert(`Платёж сохранён.\nПроценты: ${money(interest_amount)}\nВ тело: ${money(principal_amount)}\nОстаток: ${money(balance_after)}`)
  }

  async function saveSavingsSettings() {
    if (!savingsSettings) return alert('Настройки копилки не загрузились')

    const goalN = parseNumberLoose(goalInput)
    const targetMonthlyN = parseNumberLoose(targetMonthlyInput)

    if (!Number.isFinite(goalN) || goalN <= 0) return alert('Цель должна быть числом > 0')
    if (!Number.isFinite(targetMonthlyN) || targetMonthlyN < 0) return alert('Сумма в месяц должна быть числом >= 0')

    const { data, error } = await supabase
      .from('savings_settings')
      .update({ goal_amount: goalN, target_monthly: targetMonthlyN })
      .eq('id', savingsSettings.id)
      .select('*')
      .single()

    if (error) return alert(error.message)
    setSavingsSettings(data as SavingsSettings)
  }

  async function addSavingsEntry(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseNumberLoose(saveAmount)
    if (!Number.isFinite(amount) || amount <= 0) return alert('Некорректная сумма')

    const { error } = await supabase.from('savings_entries').insert({
      date: saveDate,
      amount,
      note: saveNote.trim() ? saveNote.trim() : null,
    })
    if (error) return alert(error.message)

    setSaveAmount('')
    setSaveNote('')
  }

  async function createCarryoverFromPrev() {
    const prev = monthPrev(month)

    const prevRows = rows.filter(r => r.date.startsWith(prev))
    const prevSavings = savingsEntries.filter(s => s.date.startsWith(prev))
    const prevIncome = prevRows.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0)
    const prevExpense = prevRows.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0)
    const prevSaved = prevSavings.reduce((s, e) => s + Number(e.amount), 0)

    const { data: prevCarry } = await supabase.from('month_carryovers').select('*').eq('month', prev).maybeSingle()
    const prevCarryIn = Number((prevCarry as any)?.carry_in ?? 0)

    const closingPrev = prevCarryIn + prevIncome - prevExpense - prevSaved

    const ok = confirm(`Зафиксировать перенос в месяц ${month}?\nПеренос (из ${prev}) = ${money(closingPrev)}`)
    if (!ok) return

    const { error } = await supabase
      .from('month_carryovers')
      .upsert({ month, carry_in: closingPrev }, { onConflict: 'month' })

    if (error) return alert(error.message)
  }

  async function addRecurring(e: React.FormEvent) {
    e.preventDefault()
    const title = recTitle.trim()
    const amount = parseNumberLoose(recAmount)
    const day = clampDay(Number(recDay))

    if (!title) return alert('Название обязательно')
    if (!Number.isFinite(amount) || amount < 0) return alert('Сумма некорректна')

    const { error } = await supabase.from('recurring_expenses').insert({
      title,
      amount,
      pay_day: day,
      active: true,
    })
    if (error) return alert(error.message)

    setRecTitle('')
    setRecAmount('')
    setRecDay('1')
  }

  async function deleteRecurring(r: Recurring) {
    const ok = confirm(`Удалить постоянный платёж "${r.title}"?`)
    if (!ok) return
    const { error } = await supabase.from('recurring_expenses').delete().eq('id', r.id)
    if (error) return alert(error.message)
  }

  async function payRecurring(r: Recurring) {
    const paidDate = today
    const amount = Number(r.amount)

    const ok = confirm(`Отметить как оплачено?\n${r.title}\n${money(amount)}\nДата: ${paidDate}`)
    if (!ok) return

    const { error: payErr } = await supabase
      .from('recurring_payments')
      .upsert({ recurring_id: r.id, month, paid_date: paidDate, amount }, { onConflict: 'recurring_id,month' })
    if (payErr) return alert(payErr.message)

    const { error: txErr } = await supabase.from('transactions').insert({
      date: paidDate,
      type: 'expense',
      amount,
      category: `Постоянные: ${r.title}`,
      taxable_usn: null,
      note: 'Оплата постоянного платежа',
      obligation_type: 'recurring',
      obligation_id: r.id,
    })
    if (txErr) return alert('Не удалось записать расход: ' + txErr.message)
  }

  /** cards */
  async function addCard(e: React.FormEvent) {
    e.preventDefault()
    const title = cardTitle.trim()
    const balance = parseNumberLoose(cardBalance)
    const statement_day = clampDay(Number(cardStatementDay))
    const due_day = clampDay(Number(cardDueDay))
    const min_payment_rate = parseNumberLoose(cardMinRate)

    if (!title) return alert('Название обязательно')
    if (!Number.isFinite(balance) || balance < 0) return alert('Баланс некорректен')
    if (!Number.isFinite(min_payment_rate) || min_payment_rate < 0 || min_payment_rate > 1) return alert('Min rate 0..1')

    const { error } = await supabase.from('card_accounts').insert({
      title,
      balance,
      statement_day,
      due_day,
      min_payment_rate,
      active: true,
    })
    if (error) return alert(error.message)

    setCardTitle('')
    setCardBalance('')
  }

  async function deleteCard(c: CardAccount) {
    const ok = confirm(`Удалить кредитку "${c.title}"?\nЭто удалит и события (interest/payment).`)
    if (!ok) return
    const { error } = await supabase.from('card_accounts').delete().eq('id', c.id)
    if (error) return alert(error.message)
  }

  async function addCardInterest(e: React.FormEvent) {
    e.preventDefault()
    const card = cards.find(c => c.id === addCardInterestId)
    if (!card) return alert('Выбери кредитку')

    const amount = parseNumberLoose(addCardInterestAmount)
    if (!Number.isFinite(amount) || amount <= 0) return alert('Сумма процентов некорректна')

    const { error: evErr } = await supabase.from('card_events').insert({
      card_id: card.id,
      date: addCardInterestDate,
      kind: 'interest',
      amount,
      note: 'Проценты по выписке',
    })
    if (evErr) return alert(evErr.message)

    const { error: updErr } = await supabase
      .from('card_accounts')
      .update({ balance: Number(card.balance) + amount })
      .eq('id', card.id)
    if (updErr) return alert(updErr.message)

    setAddCardInterestAmount('')
  }

  async function payCard(e: React.FormEvent) {
    e.preventDefault()
    const card = cards.find(c => c.id === payCardId)
    if (!card) return alert('Выбери кредитку')

    const amount = parseNumberLoose(payCardAmount)
    if (!Number.isFinite(amount) || amount <= 0) return alert('Сумма платежа некорректна')

    const newBal = Math.max(0, Number(card.balance) - amount)

    const { error: evErr } = await supabase.from('card_events').insert({
      card_id: card.id,
      date: payCardDate,
      kind: 'payment',
      amount,
      note: 'Платёж по кредитке',
    })
    if (evErr) return alert(evErr.message)

    const { error: updErr } = await supabase.from('card_accounts').update({ balance: newBal }).eq('id', card.id)
    if (updErr) return alert(updErr.message)

    const { error: txErr } = await supabase.from('transactions').insert({
      date: payCardDate,
      type: 'expense',
      amount,
      category: `Кредитка: ${card.title}`,
      taxable_usn: null,
      note: 'Платёж по кредитке',
      obligation_type: 'card',
      obligation_id: card.id,
    })
    if (txErr) return alert('Не удалось записать расход по кредитке: ' + txErr.message)

    setPayCardAmount('')
  }

  /** -------------------- TAXES: add / delete -------------------- */
  function taxTitle(kind: TaxPayment['kind']) {
    return kind === 'usn6' ? 'УСН 6%' : kind === 'insurance' ? 'Страховые' : '1% сверх 300к'
  }

  function taxCategory(kind: TaxPayment['kind']) {
    return kind === 'usn6' ? 'Налоги: УСН 6%' : kind === 'insurance' ? 'Налоги: страховые' : 'Налоги: 1% сверх 300к'
  }

  async function addTaxPayment(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseNumberLoose(taxAmount)
    if (!Number.isFinite(amount) || amount <= 0) return alert('Сумма некорректна')

    // ✅ сохраняем запись и получаем id
    const { data: createdTax, error: insErr } = await supabase
      .from('tax_payments')
      .insert({
        date: taxDate,
        kind: taxKind,
        amount,
        note: taxNote.trim() ? taxNote.trim() : null,
        tx_id: null,
      })
      .select('*')
      .single()

    if (insErr) return alert(insErr.message)

    // опционально писать в расходы:
    const ok = confirm('Записать этот платёж также в "Расходы"?')
    if (ok) {
      const { data: txData, error: txErr } = await supabase
        .from('transactions')
        .insert({
          date: taxDate,
          type: 'expense',
          amount,
          category: taxCategory(taxKind),
          taxable_usn: null,
          note: taxNote.trim() ? taxNote.trim() : 'Оплата налогов',
          obligation_type: 'tax',
          obligation_id: null,
        })
        .select('id')
        .single()

      if (txErr) {
        alert('Не удалось записать в расходы: ' + txErr.message)
      } else {
        // ✅ привязываем tx_id к tax_payments
        const { error: updErr } = await supabase
          .from('tax_payments')
          .update({ tx_id: txData?.id ?? null })
          .eq('id', (createdTax as TaxPayment).id)

        if (updErr) alert('Не удалось привязать tx_id: ' + updErr.message)
      }
    }

    setTaxAmount('')
    setTaxNote('')
  }

  async function deleteTaxPayment(p: TaxPayment) {
    const ok = confirm(
      `Удалить оплату налога?\n${taxTitle(p.kind)} • ${money(Number(p.amount))} • ${p.date ?? 'без даты'}\n\n` +
        (p.tx_id ? 'Также удалю связанную операцию в "Расходах".' : 'Связанной операции в "Расходах" нет.')
    )
    if (!ok) return

    // 1) удаляем связанную транзакцию (если есть)
    if (p.tx_id) {
      const { error: delTxErr } = await supabase.from('transactions').delete().eq('id', p.tx_id)
      if (delTxErr) return alert('Не удалось удалить связанную операцию (transactions): ' + delTxErr.message)
    }

    // 2) удаляем налог
    const { error: delTaxErr } = await supabase.from('tax_payments').delete().eq('id', p.id)
    if (delTaxErr) return alert('Не удалось удалить оплату налога: ' + delTaxErr.message)
  }

  /** edit / delete transactions */
  function startEditTx(r: Transaction) {
    setEditingTxId(r.id)
    setTxEditDate(r.date)
    setTxEditAmount(String(r.amount))
    setTxEditCategory(r.category || '')
    setTxEditNote(r.note || '')
    setTxEditTaxable(Boolean(r.taxable_usn))
  }

  async function saveEditTx(r: Transaction) {
    const amount = parseNumberLoose(txEditAmount)
    if (!Number.isFinite(amount) || amount <= 0) return alert('Некорректная сумма')

    const payload: Partial<Transaction> = {
      date: txEditDate,
      amount,
      category: txEditCategory.trim() || (r.type === 'expense' ? 'Расход' : 'Доход'),
      note: txEditNote.trim() ? txEditNote.trim() : null,
    }
    if (r.type === 'income') payload.taxable_usn = txEditTaxable

    const { error } = await supabase.from('transactions').update(payload).eq('id', r.id)
    if (error) return alert(error.message)

    setEditingTxId('')
  }

  async function deleteTx(r: Transaction) {
    const ok = confirm(`Удалить операцию?\n${r.type === 'income' ? 'Доход' : 'Расход'} • ${r.category} • ${money(r.amount)} • ${r.date}`)
    if (!ok) return
    const { error } = await supabase.from('transactions').delete().eq('id', r.id)
    if (error) return alert(error.message)
    if (editingTxId === r.id) setEditingTxId('')
  }

  /** default selects */
  useEffect(() => {
    if (!payLoanId && loans.some(l => l.active)) setPayLoanId(loans.find(l => l.active)?.id || '')
  }, [loans, payLoanId])

  useEffect(() => {
    if (!payCardId && cards.some(c => c.active)) setPayCardId(cards.find(c => c.active)?.id || '')
    if (!addCardInterestId && cards.some(c => c.active)) setAddCardInterestId(cards.find(c => c.active)?.id || '')
  }, [cards, payCardId, addCardInterestId])

  /** header */
  const headerMonthYear = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(month + '-01T00:00:00'))
  const headerToday = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())

  /** suggestions */
  const incomeCategories = useMemo(() => {
    const set = new Set(rows.filter(r => r.type === 'income').map(r => (r.category || '').trim()).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [rows])

  const expenseCategories = useMemo(() => {
    const set = new Set(rows.filter(r => r.type === 'expense').map(r => (r.category || '').trim()).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [rows])

  /** cards suggested min payment */
  const cardMinPayment = (c: CardAccount) => Math.max(0, Number(c.balance) * Number(c.min_payment_rate))

  return (
    <main style={ui.page}>
      {/* TOP BAR */}
      <div style={ui.topBar}>
        <button style={ui.btn} onClick={() => setMenuOpen(true)}>☰</button>
        <div style={{ fontWeight: 900, opacity: 0.95 }}>Финансы Карина</div>
      </div>

      {/* SIDEBAR */}
      {menuOpen ? <div style={ui.sidebarOverlay} onClick={() => setMenuOpen(false)} /> : null}

      <div style={{ ...ui.sidebar, ...(menuOpen ? ui.sidebarOpen : {}) }}>
        <div style={{ ...ui.row, justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 900 }}>Меню</div>
          <button style={ui.btn} onClick={() => setMenuOpen(false)}>✕</button>
        </div>

        <div style={{ height: 10 }} />

        <div style={{ display: 'grid', gap: 8 }}>
          <button
            style={{ ...ui.navBtn, ...(activeTab === 'summary' ? ui.navBtnActive : {}) }}
            onClick={() => { setActiveTab('summary'); setMenuOpen(false) }}
          >
            🏠 Обзор
          </button>

          <button
            style={{ ...ui.navBtn, ...(activeTab === 'constant' ? ui.navBtnActive : {}) }}
            onClick={() => { setActiveTab('constant'); setMenuOpen(false) }}
          >
            📌 Постоянные платежи
          </button>

          <button
            style={{ ...ui.navBtn, ...(activeTab === 'taxes' ? ui.navBtnActive : {}) }}
            onClick={() => { setActiveTab('taxes'); setMenuOpen(false) }}
          >
            🧾 Налоги
          </button>

          <button
            style={{ ...ui.navBtn, ...(activeTab === 'savings' ? ui.navBtnActive : {}) }}
            onClick={() => { setActiveTab('savings'); setMenuOpen(false) }}
          >
            🎯 Копилка
          </button>

          <button
            style={{ ...ui.navBtn, ...(activeTab === 'add' ? ui.navBtnActive : {}) }}
            onClick={() => { setActiveTab('add'); setMenuOpen(false) }}
          >
            ➕ Добавление
          </button>

          <button
            style={{ ...ui.navBtn, ...(activeTab === 'ops' ? ui.navBtnActive : {}) }}
            onClick={() => { setActiveTab('ops'); setMenuOpen(false) }}
          >
            🧾 Операции
          </button>
        </div>

        <div style={ui.divider} />

        <div style={ui.small}>
          Месяц меняется в шапке ниже. Меню не влияет на расчёты.
        </div>
      </div>

      {/* HEADER (месяц + обновление) */}
      <div style={ui.headerRow}>
        <div style={{ minWidth: 0 }}>
          <h1 style={ui.h1}>Финансы Карина</h1>
          <div style={ui.sub}>
            Месяц: <b style={{ textTransform: 'capitalize' }}>{headerMonthYear}</b> • Сегодня: <b>{headerToday}</b>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={ui.btn} onClick={() => setMonth(monthPrev(month))}>←</button>
          <input
            style={{ ...ui.input, width: 140 }}
            value={month}
            onChange={e => setMonth(e.target.value)}
            placeholder="YYYY-MM"
          />
          <button style={ui.btn} onClick={() => setMonth(monthNext(month))}>→</button>

          <button onClick={loadAll} disabled={loading} style={{ ...ui.btnPrimary, opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Обновляю…' : 'Обновить'}
          </button>
        </div>
      </div>

      {/* MAIN SUMMARY */}
      {activeTab === 'summary' ? (
        <section style={{ ...ui.card, marginTop: 14 }}>
          <div style={ui.row}>
            <span style={ui.pill}>Перенос в месяц: <b>{money(carryIn)}</b></span>
            <span style={ui.pill}>Доходы: <b>{money(incomeMonth)}</b></span>
            <span style={ui.pill}>Расходы: <b>{money(expenseMonth)}</b></span>
            <span style={ui.pill}>Копилка: <b>{money(savedThisMonth)}</b></span>
            <span style={{ ...ui.pill, borderColor: 'rgba(255,255,255,0.22)' }}>
              Текущий остаток: <b>{money(currentBalance)}</b>
            </span>
          </div>

          <div style={ui.divider} />

          <div style={{ ...ui.row, alignItems: 'flex-start' }}>
            <div style={{ flex: '2 1 520px', minWidth: 260 }}>
              <div style={ui.cardTitle}>🧠 Лимит трат “сегодня и дальше” (от остатка)</div>
              <div style={{ opacity: 0.9, lineHeight: 1.5 }}>
                <div>Остаток сейчас: <b>{money(currentBalance)}</b></div>
                <div>Нужно ещё в копилку в этом месяце: <b>{money(remainingSaveThisMonth)}</b></div>
                <div style={{ marginTop: 8 }}>
                  Тогда лимит трат с сегодняшнего дня: <b>{money(limitPerDayFromToday)}</b> / день (дней осталось: {daysLeft})
                </div>
                <div style={{ marginTop: 8, ...ui.small }}>
                  УСН 6% считаю как резерв для планирования: <b>{money(usnReserve)}</b>.
                </div>
              </div>
            </div>

            <div style={{ flex: '1 1 360px', minWidth: 260 }}>
              <div style={ui.cardTitle}>Перенос остатка</div>
              <div style={{ ...ui.small, marginBottom: 8 }}>
                Перенос фиксируется кнопкой (ничего случайно не “уедет”).
              </div>
              <button style={{ ...ui.btnPrimary, width: '100%' }} onClick={createCarryoverFromPrev}>
                Зафиксировать перенос из прошлого месяца
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <div style={ui.grid}>
        {/* CONSTANT EXPENSES */}
        {activeTab === 'constant' ? (
          <section style={ui.card}>
            <div style={ui.cardTitle}>📌 Постоянные расходы (оплата → только тогда пишется в “Расходы”)</div>

            <div style={{ ...ui.cards, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
              {/* Loans list */}
              <div style={ui.card}>
                <div style={ui.cardTitle}>Кредиты</div>
                {loans.length === 0 ? <div style={{ opacity: 0.75 }}>Пока нет.</div> : null}
                <div style={{ display: 'grid', gap: 8 }}>
                  {loans.map(l => {
                    const dueDate = `${month}-${String(clampDay(Number(l.payment_day))).padStart(2, '0')}`
                    const paid = loansPaidThisMonthSet.has(l.id)
                    return (
                      <div key={l.id} style={{ padding: 10, borderRadius: 12, borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.10)', background: 'rgba(0,0,0,0.22)' }}>
                        <div style={{ fontWeight: 900 }}>{l.title} {l.active ? '' : '(закрыт)'}</div>
                        <div style={ui.small}>Дата оплаты: {dueDate}</div>
                        <div style={ui.small}>Платёж: <b>{money(Number(l.monthly_payment))}</b> • Остаток: <b>{money(Number(l.balance))}</b></div>
                        <div style={{ ...ui.row, marginTop: 8 }}>
                          <button
                            style={{ ...ui.btnPrimary, opacity: paid ? 0.6 : 1 }}
                            disabled={paid || !l.active}
                            onClick={async () => {
                              setPayLoanId(l.id)
                              setPayLoanDate(today)
                              setPayLoanAmount(String(l.monthly_payment))
                              alert('Вставила кредит в форму “Платёж по кредиту”. Перейди во вкладку “Добавление” и нажми “Сохранить платёж”.')
                              setActiveTab('add')
                            }}
                          >
                            {paid ? 'Оплачено (в этом месяце)' : 'Оплатить'}
                          </button>
                          <button style={ui.btn} onClick={() => deleteLoan(l)}>Удалить</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Cards list */}
              <div style={ui.card}>
                <div style={ui.cardTitle}>Кредитки</div>
                {cards.length === 0 ? <div style={{ opacity: 0.75 }}>Пока нет.</div> : null}
                <div style={{ display: 'grid', gap: 8 }}>
                  {cards.map(c => {
                    const dueDate = `${month}-${String(clampDay(Number(c.due_day))).padStart(2, '0')}`
                    const paid = cardsPaidThisMonthSet.has(c.id)
                    const suggestedMin = cardMinPayment(c)
                    return (
                      <div key={c.id} style={{ padding: 10, borderRadius: 12, borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.10)', background: 'rgba(0,0,0,0.22)' }}>
                        <div style={{ fontWeight: 900 }}>{c.title} {c.active ? '' : '(неактивна)'}</div>
                        <div style={ui.small}>Дата оплаты: {dueDate}</div>
                        <div style={ui.small}>Долг сейчас: <b>{money(Number(c.balance))}</b> • Мин.платёж (рекоменд.): <b>{money(suggestedMin)}</b></div>
                        <div style={{ ...ui.row, marginTop: 8 }}>
                          <button
                            style={{ ...ui.btnPrimary, opacity: paid ? 0.6 : 1 }}
                            disabled={paid || !c.active}
                            onClick={() => {
                              setPayCardId(c.id)
                              setPayCardDate(today)
                              setPayCardAmount(String(Math.round(suggestedMin)))
                              alert('Вставила кредитку в форму “Платёж по кредитке”. Перейди во вкладку “Добавление” и нажми “Оплатить кредитку”.')
                              setActiveTab('add')
                            }}
                          >
                            {paid ? 'Оплачено (в этом месяце)' : 'Оплатить'}
                          </button>
                          <button style={ui.btn} onClick={() => deleteCard(c)}>Удалить</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Recurring list */}
              <div style={ui.card}>
                <div style={ui.cardTitle}>Мои постоянные платежи</div>

                <form onSubmit={addRecurring} style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
                  <input style={ui.input} value={recTitle} onChange={e => setRecTitle(e.target.value)} placeholder="Например: Аренда" />
                  <input style={ui.input} value={recAmount} onChange={e => setRecAmount(e.target.value)} placeholder="Сумма, ₽" />
                  <input style={ui.input} value={recDay} onChange={e => setRecDay(e.target.value)} placeholder="День оплаты (1–28)" />
                  <button type="submit" style={{ ...ui.btnPrimary, width: '100%' }}>Добавить постоянный платёж</button>
                </form>

                {recurrings.length === 0 ? <div style={{ opacity: 0.75 }}>Пока нет.</div> : null}
                <div style={{ display: 'grid', gap: 8 }}>
                  {recurrings.filter(r => r.active).map(r => {
                    const dueDate = `${month}-${String(clampDay(Number(r.pay_day))).padStart(2, '0')}`
                    const paid = recurringPaidThisMonthSet.has(r.id)
                    return (
                      <div key={r.id} style={{ padding: 10, borderRadius: 12, borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.10)', background: 'rgba(0,0,0,0.22)' }}>
                        <div style={{ fontWeight: 900 }}>{r.title}</div>
                        <div style={ui.small}>Дата оплаты: {dueDate}</div>
                        <div style={ui.small}>Сумма: <b>{money(Number(r.amount))}</b></div>
                        <div style={{ ...ui.row, marginTop: 8 }}>
                          <button
                            style={{ ...ui.btnPrimary, opacity: paid ? 0.6 : 1 }}
                            disabled={paid}
                            onClick={() => payRecurring(r)}
                          >
                            {paid ? 'Оплачено (в этом месяце)' : 'Отметить “Оплачено”'}
                          </button>
                          <button style={ui.btn} onClick={() => deleteRecurring(r)}>Удалить</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* TAXES */}
        {activeTab === 'taxes' ? (
          <section style={ui.card}>
            <div style={ui.cardTitle}>🧾 Налоги (считаю автоматически, оплаты ты вносишь сама)</div>

            <div style={ui.row}>
              <span style={ui.pill}>Страховые к уплате (год): <b>{money(insuranceDueYear)}</b></span>
              <span style={ui.pill}>Оплачено (год): <b>{money(paidInsuranceYear)}</b></span>
              <span style={ui.pill}>Осталось: <b>{money(insuranceRemain)}</b></span>
            </div>

            <div style={{ ...ui.row, marginTop: 8 }}>
              <span style={ui.pill}>1% сверх 300к (год): <b>{money(extraDueYear)}</b></span>
              <span style={ui.pill}>Оплачено (год): <b>{money(paidExtraYear)}</b></span>
              <span style={ui.pill}>Осталось: <b>{money(extraRemain)}</b></span>
            </div>

            <div style={{ ...ui.row, marginTop: 8 }}>
              <span style={ui.pill}>УСН 6% к уплате (год): <b>{money(usnDueYear)}</b></span>
              <span style={ui.pill}>Оплачено УСН (год): <b>{money(paidUsnYear)}</b></span>
              <span style={ui.pill}>Осталось УСН (год): <b>{money(usnRemainYear)}</b></span>
              <span style={ui.pill}>Резерв УСН 6% (месяц): <b>{money(usnReserve)}</b></span>
            </div>

            <div style={ui.divider} />

            <div style={{ ...ui.cards, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              <form onSubmit={addTaxPayment} style={ui.card}>
                <div style={ui.cardTitle}>Добавить оплату налога</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <input type="date" style={ui.input as any} value={taxDate} onChange={e => setTaxDate(e.target.value)} />
                  <select style={ui.select} value={taxKind} onChange={e => setTaxKind(e.target.value as any)}>
                    <option value="usn6">УСН 6%</option>
                    <option value="insurance">Страховые</option>
                    <option value="extra1">1% сверх 300к</option>
                  </select>
                  <input style={ui.input} value={taxAmount} onChange={e => setTaxAmount(e.target.value)} placeholder="Сумма, ₽" />
                  <input style={ui.input} value={taxNote} onChange={e => setTaxNote(e.target.value)} placeholder="Комментарий (необязательно)" />
                  <button type="submit" style={{ ...ui.btnPrimary, width: '100%' }}>Сохранить оплату</button>
                </div>
              </form>

              <div style={ui.card}>
                <div style={ui.cardTitle}>История оплат</div>
                {taxPayments.length === 0 ? <div style={{ opacity: 0.75 }}>Пока пусто.</div> : null}
                <div style={{ display: 'grid', gap: 8 }}>
                  {taxPayments.slice(0, 30).map(p => (
                    <div
                      key={p.id}
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderStyle: 'solid',
                        borderColor: 'rgba(255,255,255,0.10)',
                        background: 'rgba(0,0,0,0.22)',
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>
                        {taxTitle(p.kind)} • {money(Number(p.amount))}
                      </div>
                      <div style={ui.small}>
                        {p.date ?? '—'} • Добавлено: {fmtDateTimeRu(p.created_at)}
                        {p.tx_id ? <span style={{ opacity: 0.85 }}> • есть запись в расходах</span> : null}
                      </div>
                      {p.note ? <div style={{ ...ui.small, opacity: 0.85 }}>{p.note}</div> : null}

                      <div style={{ ...ui.row, marginTop: 8 }}>
                        <button style={ui.btn} onClick={() => deleteTaxPayment(p)}>Удалить</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* Savings */}
        {activeTab === 'savings' ? (
          <section style={ui.card}>
            <div style={ui.cardTitle}>🎯 Копилка</div>

            <div style={ui.row}>
              <span style={ui.pill}>Цель: <b>{money(goal)}</b></span>
              <span style={ui.pill}>Хочу в месяц: <b>{money(targetMonthly)}</b></span>
              <span style={ui.pill}>В этом месяце: <b>{money(savedThisMonth)}</b></span>
              <span style={ui.pill}>Осталось доложить: <b>{money(remainingSaveThisMonth)}</b></span>
            </div>

            <div style={ui.divider} />

            <div style={ui.cards}>
              <div style={ui.card}>
                <div style={ui.cardTitle}>Настройки</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <input style={ui.input} value={goalInput} onChange={e => setGoalInput(e.target.value)} placeholder="Цель, ₽" />
                  <input style={ui.input} value={targetMonthlyInput} onChange={e => setTargetMonthlyInput(e.target.value)} placeholder="Хочу в месяц, ₽" />
                  <button style={{ ...ui.btnPrimary, width: '100%' }} onClick={saveSavingsSettings}>
                    Сохранить настройки
                  </button>
                </div>
              </div>

              <div style={ui.card}>
                <div style={ui.cardTitle}>Внести</div>
                <form onSubmit={addSavingsEntry} style={{ display: 'grid', gap: 8 }}>
                  <input type="date" style={ui.input as any} value={saveDate} onChange={e => setSaveDate(e.target.value)} />
                  <input style={ui.input} value={saveAmount} onChange={e => setSaveAmount(e.target.value)} placeholder="Сумма, ₽" />
                  <input style={ui.input} value={saveNote} onChange={e => setSaveNote(e.target.value)} placeholder="Комментарий" />
                  <button type="submit" style={{ ...ui.btnPrimary, width: '100%' }}>Добавить</button>
                </form>
              </div>
            </div>
          </section>
        ) : null}

        {/* Add income/expense + loan/card actions */}
        {activeTab === 'add' ? (
          <section style={ui.card}>
            <div style={ui.cardTitle}>Добавление (доход / расход / кредиты / кредитки)</div>

            <datalist id="income-cats">
              {incomeCategories.map(c => <option key={c} value={c} />)}
            </datalist>
            <datalist id="expense-cats">
              {expenseCategories.map(c => <option key={c} value={c} />)}
            </datalist>

            <div style={ui.cards}>
              {/* ДОХОД */}
              <form onSubmit={submitIncome} style={ui.card}>
                <div style={ui.cardTitle}>+ Доход</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <input type="date" value={incomeDate} onChange={e => setIncomeDate(e.target.value)} style={ui.input as any} />
                  <input value={incomeAmount} onChange={e => setIncomeAmount(e.target.value)} placeholder="Сумма, ₽" style={ui.input} />
                  <input list="income-cats" value={incomeCategory} onChange={e => setIncomeCategory(e.target.value)} placeholder="Категория" style={ui.input} />
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, opacity: 0.95 }}>
                    <input type="checkbox" checked={incomeTaxable} onChange={e => setIncomeTaxable(e.target.checked)} />
                    Облагается УСН 6% (резерв для планирования)
                  </label>
                  <input value={incomeNote} onChange={e => setIncomeNote(e.target.value)} placeholder="Комментарий" style={ui.input} />
                  <button type="submit" style={{ ...ui.btnPrimary, width: '100%' }}>Добавить доход</button>
                </div>
              </form>

              {/* РАСХОД */}
              <form onSubmit={submitExpense} style={ui.card}>
                <div style={ui.cardTitle}>- Расход</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} style={ui.input as any} />
                  <input value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="Сумма, ₽" style={ui.input} />
                  <input list="expense-cats" value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)} placeholder="Категория" style={ui.input} />
                  <input value={expenseNote} onChange={e => setExpenseNote(e.target.value)} placeholder="Комментарий" style={ui.input} />
                  <button type="submit" style={{ ...ui.btnPrimary, width: '100%' }}>Добавить расход</button>
                </div>
              </form>

              {/* КРЕДИТ */}
              <form onSubmit={submitLoan} style={ui.card}>
                <div style={ui.cardTitle}>+ Кредит</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <input value={loanTitle} onChange={e => setLoanTitle(e.target.value)} placeholder="Название" style={ui.input} />
                  <input value={loanBalance} onChange={e => setLoanBalance(e.target.value)} placeholder="Остаток долга, ₽" style={ui.input} />
                  <input value={loanMonthly} onChange={e => setLoanMonthly(e.target.value)} placeholder="Ежемесячный платёж, ₽" style={ui.input} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input value={loanDay} onChange={e => setLoanDay(e.target.value)} placeholder="День (1–28)" style={ui.input} />
                    <input value={loanRate} onChange={e => setLoanRate(e.target.value)} placeholder="Ставка, %" style={ui.input} />
                  </div>
                  <button type="submit" style={{ ...ui.btnPrimary, width: '100%' }}>Добавить кредит</button>
                </div>
              </form>

              {/* ПЛАТЕЖ ПО КРЕДИТУ */}
              <form onSubmit={submitLoanPayment} style={ui.card}>
                <div style={ui.cardTitle}>Платёж по кредиту (запишется и в расходы)</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <select value={payLoanId} onChange={e => setPayLoanId(e.target.value)} style={ui.select}>
                    <option value="">— выбери кредит —</option>
                    {loans.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.title} {l.active ? '' : '(закрыт)'}
                      </option>
                    ))}
                  </select>
                  <input type="date" value={payLoanDate} onChange={e => setPayLoanDate(e.target.value)} style={ui.input as any} />
                  <input value={payLoanAmount} onChange={e => setPayLoanAmount(e.target.value)} placeholder="Сумма платежа, ₽" style={ui.input} />
                  <button type="submit" style={{ ...ui.btnPrimary, width: '100%' }}>Сохранить платёж</button>
                </div>
              </form>

              {/* КРЕДИТКА */}
              <form onSubmit={addCard} style={ui.card}>
                <div style={ui.cardTitle}>+ Кредитка</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <input style={ui.input} value={cardTitle} onChange={e => setCardTitle(e.target.value)} placeholder="Название" />
                  <input style={ui.input} value={cardBalance} onChange={e => setCardBalance(e.target.value)} placeholder="Долг сейчас, ₽" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input style={ui.input} value={cardStatementDay} onChange={e => setCardStatementDay(e.target.value)} placeholder="День выписки (1–28)" />
                    <input style={ui.input} value={cardDueDay} onChange={e => setCardDueDay(e.target.value)} placeholder="День оплаты (1–28)" />
                  </div>
                  <input style={ui.input} value={cardMinRate} onChange={e => setCardMinRate(e.target.value)} placeholder="Min rate (например 0.05)" />
                  <button type="submit" style={{ ...ui.btnPrimary, width: '100%' }}>Добавить кредитку</button>
                </div>
              </form>

              {/* ПРОЦЕНТЫ ПО КРЕДИТКЕ */}
              <form onSubmit={addCardInterest} style={ui.card}>
                <div style={ui.cardTitle}>Проценты по выписке (начислить)</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <select value={addCardInterestId} onChange={e => setAddCardInterestId(e.target.value)} style={ui.select}>
                    <option value="">— выбери кредитку —</option>
                    {cards.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                  <input type="date" value={addCardInterestDate} onChange={e => setAddCardInterestDate(e.target.value)} style={ui.input as any} />
                  <input value={addCardInterestAmount} onChange={e => setAddCardInterestAmount(e.target.value)} placeholder="Сумма процентов, ₽" style={ui.input} />
                  <button type="submit" style={{ ...ui.btnPrimary, width: '100%' }}>Начислить проценты</button>
                </div>
              </form>

              {/* ПЛАТЕЖ ПО КРЕДИТКЕ */}
              <form onSubmit={payCard} style={ui.card}>
                <div style={ui.cardTitle}>Платёж по кредитке (запишется и в расходы)</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <select value={payCardId} onChange={e => setPayCardId(e.target.value)} style={ui.select}>
                    <option value="">— выбери кредитку —</option>
                    {cards.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                  <input type="date" value={payCardDate} onChange={e => setPayCardDate(e.target.value)} style={ui.input as any} />
                  <input value={payCardAmount} onChange={e => setPayCardAmount(e.target.value)} placeholder="Сумма оплаты, ₽" style={ui.input} />
                  <button type="submit" style={{ ...ui.btnPrimary, width: '100%' }}>Оплатить кредитку</button>
                </div>
              </form>
            </div>
          </section>
        ) : null}

        {/* Transactions list */}
        {activeTab === 'ops' ? (
          <section style={ui.card}>
            <div style={ui.cardTitle}>Операции (в выбранном месяце)</div>

            <div style={{ display: 'grid', gap: 8 }}>
              {rowsMonth.map(r => {
                const isEditing = editingTxId === r.id
                const catsId = r.type === 'income' ? 'income-cats' : 'expense-cats'
                return (
                  <div
                    key={r.id}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderStyle: 'solid',
                      borderColor: 'rgba(255,255,255,0.10)',
                      background: 'rgba(0,0,0,0.22)',
                    }}
                  >
                    {!isEditing ? (
                      <div style={ui.row}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <b>{r.type === 'expense' ? 'Расход' : 'Доход'}</b> • {r.category}
                          {r.note ? <span style={{ opacity: 0.7 }}> • {r.note}</span> : null}
                          <div style={ui.small}>
                            Дата: <b>{r.date}</b> • Добавлено: {fmtDateTimeRu(r.created_at)}
                          </div>
                          {r.obligation_type ? <div style={ui.small}>Источник: <b>{r.obligation_type}</b></div> : null}
                        </div>

                        <div style={{ fontWeight: 900 }}>{money(Number(r.amount))}</div>
                        <button style={ui.btn} onClick={() => startEditTx(r)}>Редактировать</button>
                        <button style={ui.btn} onClick={() => deleteTx(r)}>Удалить</button>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontWeight: 900, marginBottom: 8 }}>
                          Редактирование: {r.type === 'expense' ? 'расход' : 'доход'}
                        </div>

                        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                          <input type="date" value={txEditDate} onChange={e => setTxEditDate(e.target.value)} style={ui.input as any} />
                          <input value={txEditAmount} onChange={e => setTxEditAmount(e.target.value)} placeholder="Сумма" style={ui.input} />
                          <input list={catsId} value={txEditCategory} onChange={e => setTxEditCategory(e.target.value)} placeholder="Категория" style={ui.input} />
                          <input value={txEditNote} onChange={e => setTxEditNote(e.target.value)} placeholder="Комментарий" style={ui.input} />
                          {r.type === 'income' ? (
                            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                              <input type="checkbox" checked={txEditTaxable} onChange={e => setTxEditTaxable(e.target.checked)} />
                              Облагается УСН 6% (резерв)
                            </label>
                          ) : null}
                        </div>

                        <div style={{ ...ui.row, marginTop: 10 }}>
                          <button style={ui.btnPrimary} onClick={() => saveEditTx(r)}>Сохранить</button>
                          <button style={ui.btn} onClick={() => setEditingTxId('')}>Отмена</button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}