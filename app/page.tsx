'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../lib/supabase'

type Transaction = {
  id: string
  date: string
  type: string // ⚠️ было 'income' | 'expense' — теперь строка, чтобы ловить старые значения
  amount: number
  category: string
  taxable_usn: boolean | null
  note: string | null
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

type IpPayment = {
  id: string
  date: string
  amount: number
  kind: string
  note: string | null
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

function toDateOnly(d: Date) {
  return d.toISOString().slice(0, 10)
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

function daysBetween(dateA: string, dateB: string) {
  const a = new Date(dateA + 'T00:00:00')
  const b = new Date(dateB + 'T00:00:00')
  const diff = b.getTime() - a.getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
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

/**
 * ✅ КЛЮЧЕВОЕ: нормализация типа операции
 * Считает расходами любые варианты: 'expense', 'расход', 'Расход', 'outcome', '-'
 */
function normTxType(raw: any): 'income' | 'expense' {
  const t = String(raw ?? '').trim().toLowerCase()
  if (t === 'income' || t === 'доход' || t === '+' || t === 'in') return 'income'
  if (t === 'expense' || t === 'расход' || t === '-' || t === 'outcome' || t === 'spend') return 'expense'
  // безопасное значение по умолчанию:
  return 'expense'
}

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

  h1: { fontSize: 28, fontWeight: 900, margin: 0 } as CSSProperties,
  sub: { opacity: 0.78, marginTop: 6 } as CSSProperties,

  grid: {
    display: 'grid',
    gap: 12,
    marginTop: 14,
  } as CSSProperties,

  cards: {
    display: 'grid',
    gap: 12,
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  } as CSSProperties,

  card: {
    border: '1px solid rgba(255,255,255,0.10)',
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
    border: '1px solid rgba(255,255,255,0.12)',
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
    border: '1px solid rgba(255,255,255,0.12)',
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
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.06)',
    color: '#f3f3f3',
    cursor: 'pointer',
    fontSize: 16,
  } as CSSProperties,

  btnPrimary: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.25)',
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
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    fontSize: 12,
    opacity: 0.95,
    minWidth: 0,
  } as CSSProperties,

  progressWrap: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  } as CSSProperties,

  progressBar: (pct: number) =>
    ({
      height: '100%',
      width: `${Math.max(0, Math.min(100, pct))}%`,
      background: 'rgba(255,255,255,0.45)',
    }) as CSSProperties,
}

export default function Home() {
  const today = toDateOnly(new Date())

  const [rows, setRows] = useState<Transaction[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [loanPayments, setLoanPayments] = useState<Record<string, LoanPayment[]>>({})
  const [ipSettings, setIpSettings] = useState<IpSettings | null>(null)
  const [ipPayments, setIpPayments] = useState<IpPayment[]>([])
  const [savingsSettings, setSavingsSettings] = useState<SavingsSettings | null>(null)
  const [savingsEntries, setSavingsEntries] = useState<SavingsEntry[]>([])
  const [loading, setLoading] = useState(false)

  const [incomeDate, setIncomeDate] = useState(today)
  const [incomeAmount, setIncomeAmount] = useState('')
  const [incomeCategory, setIncomeCategory] = useState('Основной доход')
  const [incomeTaxable, setIncomeTaxable] = useState(true)
  const [incomeNote, setIncomeNote] = useState('')

  const [expenseDate, setExpenseDate] = useState(today)
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('Еда')
  const [expenseNote, setExpenseNote] = useState('')

  const [ipPayDate, setIpPayDate] = useState(today)
  const [ipPayAmount, setIpPayAmount] = useState('')
  const [ipPayKind, setIpPayKind] = useState<'any' | 'fixed' | 'extra'>('any')
  const [ipPayNote, setIpPayNote] = useState('')

  const [loanTitle, setLoanTitle] = useState('')
  const [loanBalance, setLoanBalance] = useState('')
  const [loanMonthly, setLoanMonthly] = useState('')
  const [loanDay, setLoanDay] = useState('10')
  const [loanRate, setLoanRate] = useState('24')

  const [payLoanId, setPayLoanId] = useState<string>('')
  const [payLoanDate, setPayLoanDate] = useState(today)
  const [payLoanAmount, setPayLoanAmount] = useState('')

  const [goalInput, setGoalInput] = useState('1000000')
  const [targetMonthlyInput, setTargetMonthlyInput] = useState('0')

  const [saveDate, setSaveDate] = useState(today)
  const [saveAmount, setSaveAmount] = useState('')
  const [saveNote, setSaveNote] = useState('')

  const [plannedIncomeMonth, setPlannedIncomeMonth] = useState<string>('')

  const [editingTxId, setEditingTxId] = useState<string>('')
  const [txEditDate, setTxEditDate] = useState(today)
  const [txEditAmount, setTxEditAmount] = useState('')
  const [txEditCategory, setTxEditCategory] = useState('')
  const [txEditNote, setTxEditNote] = useState('')
  const [txEditTaxable, setTxEditTaxable] = useState(false)

  const [editingSaveId, setEditingSaveId] = useState('')
  const [saveEditDate, setSaveEditDate] = useState(today)
  const [saveEditAmount, setSaveEditAmount] = useState('')
  const [saveEditNote, setSaveEditNote] = useState('')

  async function loadTransactions() {
    const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false })
    if (error) return alert('transactions: ' + error.message)
    setRows((data as Transaction[]) || [])
  }

  async function loadLoans() {
    const { data, error } = await supabase.from('loans').select('*').order('created_at', { ascending: false })
    if (error) return alert('loans: ' + error.message)
    setLoans((data as Loan[]) || [])
  }

  async function loadLoanPayments() {
    const { data, error } = await supabase.from('loan_payments').select('*').order('payment_date', { ascending: false }).limit(500)
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

  async function loadIpPayments() {
    const { data, error } = await supabase.from('ip_payments').select('*').order('date', { ascending: false }).limit(300)
    if (error) return alert('ip_payments: ' + error.message)
    setIpPayments((data as IpPayment[]) || [])
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
    const { data, error } = await supabase.from('savings_entries').select('*').order('date', { ascending: false }).limit(300)
    if (error) return alert('savings_entries: ' + error.message)
    setSavingsEntries((data as SavingsEntry[]) || [])
  }

  async function loadAll() {
    setLoading(true)
    await Promise.all([
      loadTransactions(),
      loadLoans(),
      loadLoanPayments(),
      ensureIpSettingsRow(),
      loadIpPayments(),
      ensureSavingsSettingsRow(),
      loadSavingsEntries(),
    ])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    const k = 'finance_app_planned_income_month'
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(k) : null
    if (saved && plannedIncomeMonth === '') setPlannedIncomeMonth(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const k = 'finance_app_planned_income_month'
    if (typeof window !== 'undefined') window.localStorage.setItem(k, plannedIncomeMonth)
  }, [plannedIncomeMonth])

  const incomeCategories = useMemo(() => {
    const set = new Set(
      rows
        .filter(r => normTxType(r.type) === 'income')
        .map(r => (r.category || '').trim())
        .filter(Boolean)
    )
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [rows])

  const expenseCategories = useMemo(() => {
    const set = new Set(
      rows
        .filter(r => normTxType(r.type) === 'expense')
        .map(r => (r.category || '').trim())
        .filter(Boolean)
    )
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [rows])

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
    await loadTransactions()
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
    await loadTransactions()
  }

  async function submitIpPayment(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseNumberLoose(ipPayAmount)
    if (!Number.isFinite(amount) || amount <= 0) return alert('Некорректная сумма оплаты')

    const { error } = await supabase.from('ip_payments').insert({
      date: ipPayDate,
      amount,
      kind: ipPayKind,
      note: ipPayNote.trim() ? ipPayNote.trim() : null,
    })
    if (error) return alert(error.message)

    setIpPayAmount('')
    setIpPayNote('')
    await loadIpPayments()
  }

  async function submitLoan(e: React.FormEvent) {
    e.preventDefault()

    const title = loanTitle.trim()
    if (!title) return alert('Название кредита обязательно')

    const balance = parseNumberLoose(loanBalance)
    const monthly_payment = parseNumberLoose(loanMonthly)
    const payment_day = Number(loanDay)
    const annual_rate = parseNumberLoose(loanRate)

    if (!Number.isFinite(balance) || balance <= 0) return alert('Некорректный остаток долга')
    if (!Number.isFinite(monthly_payment) || monthly_payment <= 0) return alert('Некорректный ежемесячный платёж')
    if (!Number.isFinite(payment_day) || payment_day < 1 || payment_day > 28) return alert('День платежа 1–28')
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
    await loadLoans()
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
    const days = daysBetween(startDate, payLoanDate)

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

    setPayLoanAmount('')
    await Promise.all([loadLoans(), loadLoanPayments()])
    alert(`Платёж сохранён.\nДней: ${days}\nПроценты: ${money(interest_amount)}\nВ тело: ${money(principal_amount)}\nОстаток: ${money(balance_after)}`)
  }

  async function saveSavingsSettings() {
    if (!savingsSettings) return alert('Настройки копилки не загрузились')

    const goal = parseNumberLoose(goalInput)
    const targetMonthly = parseNumberLoose(targetMonthlyInput)

    if (!Number.isFinite(goal) || goal <= 0) return alert('Цель должна быть числом > 0')
    if (!Number.isFinite(targetMonthly) || targetMonthly < 0) return alert('Сумма в месяц должна быть числом >= 0')

    const { data, error } = await supabase
      .from('savings_settings')
      .update({ goal_amount: goal, target_monthly: targetMonthly })
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
    await loadSavingsEntries()
  }

  async function addRecommendedToday(savePerDayFromToday: number) {
    const todayStr = toDateOnly(new Date())
    const recommended = Math.max(0, Math.round(savePerDayFromToday))

    if (recommended <= 0) {
      alert('Сегодня ничего не требуется откладывать 👍')
      return
    }

    const ok = confirm(`Добавить в копилку сегодня ${money(recommended)}?\nДата: ${todayStr}`)
    if (!ok) return

    const { error } = await supabase.from('savings_entries').insert({
      date: todayStr,
      amount: recommended,
      note: 'Рекомендовано системой',
    })

    if (error) {
      alert(error.message)
      return
    }

    await loadSavingsEntries()
  }

  function startEditTx(r: Transaction) {
    const t = normTxType(r.type)
    setEditingTxId(r.id)
    setTxEditDate(r.date)
    setTxEditAmount(String(r.amount))
    setTxEditCategory(r.category || '')
    setTxEditNote(r.note || '')
    setTxEditTaxable(t === 'income' ? Boolean(r.taxable_usn) : false)
  }

  async function saveEditTx(r: Transaction) {
    const amount = parseNumberLoose(txEditAmount)
    if (!Number.isFinite(amount) || amount <= 0) return alert('Некорректная сумма')

    const t = normTxType(r.type)

    const payload: Partial<Transaction> = {
      date: txEditDate,
      amount,
      category: txEditCategory.trim() || (t === 'expense' ? 'Расход' : 'Доход'),
      note: txEditNote.trim() ? txEditNote.trim() : null,
    }
    if (t === 'income') payload.taxable_usn = txEditTaxable

    const { error } = await supabase.from('transactions').update(payload).eq('id', r.id)
    if (error) return alert(error.message)

    setEditingTxId('')
    await loadTransactions()
  }

  async function deleteTx(r: Transaction) {
    const t = normTxType(r.type)
    const ok = confirm(`Удалить операцию?\n${t === 'income' ? 'Доход' : 'Расход'} • ${r.category} • ${money(r.amount)} • ${r.date}`)
    if (!ok) return

    const { error } = await supabase.from('transactions').delete().eq('id', r.id)
    if (error) return alert(error.message)

    if (editingTxId === r.id) setEditingTxId('')
    await loadTransactions()
  }

  function startEditSave(s: SavingsEntry) {
    setEditingSaveId(s.id)
    setSaveEditDate(s.date)
    setSaveEditAmount(String(s.amount))
    setSaveEditNote(s.note || '')
  }

  async function saveEditSave(s: SavingsEntry) {
    const amount = parseNumberLoose(saveEditAmount)
    if (!Number.isFinite(amount) || amount <= 0) return alert('Некорректная сумма')

    const { error } = await supabase
      .from('savings_entries')
      .update({ date: saveEditDate, amount, note: saveEditNote.trim() ? saveEditNote.trim() : null })
      .eq('id', s.id)

    if (error) return alert(error.message)
    setEditingSaveId('')
    await loadSavingsEntries()
  }

  async function deleteSave(s: SavingsEntry) {
    const ok = confirm(`Удалить взнос в копилку?\n${s.date} • ${money(s.amount)}`)
    if (!ok) return

    const { error } = await supabase.from('savings_entries').delete().eq('id', s.id)
    if (error) return alert(error.message)

    if (editingSaveId === s.id) setEditingSaveId('')
    await loadSavingsEntries()
  }

  useEffect(() => {
    if (!payLoanId && loans.some(l => l.active)) setPayLoanId(loans.find(l => l.active)?.id || '')
  }, [loans, payLoanId])

  // ---------- calculations ----------
  const now = new Date()
  const currentMonth = now.toISOString().slice(0, 7)
  const currentYear = now.toISOString().slice(0, 4)

  const headerMonthYear = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(now)
  const headerToday = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(now)

  const incomeMonth = useMemo(
    () => rows.filter(r => normTxType(r.type) === 'income' && r.date.startsWith(currentMonth)).reduce((s, r) => s + Number(r.amount), 0),
    [rows, currentMonth]
  )

  const expenseMonth = useMemo(
    () => rows.filter(r => normTxType(r.type) === 'expense' && r.date.startsWith(currentMonth)).reduce((s, r) => s + Number(r.amount), 0),
    [rows, currentMonth]
  )

  const taxableIncomeMonth = useMemo(
    () =>
      rows
        .filter(r => normTxType(r.type) === 'income' && r.taxable_usn === true && r.date.startsWith(currentMonth))
        .reduce((s, r) => s + Number(r.amount), 0),
    [rows, currentMonth]
  )

  const taxableIncomeYear = useMemo(
    () =>
      rows
        .filter(r => normTxType(r.type) === 'income' && r.taxable_usn === true && r.date.startsWith(currentYear))
        .reduce((s, r) => s + Number(r.amount), 0),
    [rows, currentYear]
  )

  const usnReserve = taxableIncomeMonth * 0.06
  const loansPlannedMonth = useMemo(() => loans.filter(l => l.active).reduce((s, l) => s + Number(l.monthly_payment), 0), [loans])

  const annualFixed = Number(ipSettings?.annual_fixed ?? 0)
  const extraRate = Number(ipSettings?.extra_rate ?? 0.01)
  const thresholdYear = 300_000
  const extraBaseYear = Math.max(0, taxableIncomeYear - thresholdYear)
  const extraDueYear = extraBaseYear * extraRate
  const ipDueYear = annualFixed + extraDueYear
  const ipPaidYear = ipPayments.filter(p => p.date.startsWith(currentYear)).reduce((s, p) => s + Number(p.amount), 0)
  const ipRemainingYear = Math.max(0, ipDueYear - ipPaidYear)

  const monthIndex = now.getMonth() + 1
  const monthsLeft = Math.max(1, 12 - monthIndex + 1)
  const ipReserveMonth = ipRemainingYear / monthsLeft

  const totalSavedAll = useMemo(() => savingsEntries.reduce((s, e) => s + Number(e.amount), 0), [savingsEntries])
  const savedThisMonth = useMemo(
    () => savingsEntries.filter(e => e.date.startsWith(currentMonth)).reduce((s, e) => s + Number(e.amount), 0),
    [savingsEntries, currentMonth]
  )

  const goal = Number(savingsSettings?.goal_amount ?? 1000000)
  const targetMonthly = Number(savingsSettings?.target_monthly ?? 0)

  const remainingToGoal = Math.max(0, goal - totalSavedAll)
  const goalPct = goal > 0 ? (totalSavedAll / goal) * 100 : 0
  const estMonths = targetMonthly > 0 ? Math.ceil(remainingToGoal / targetMonthly) : null

  const y = now.getFullYear()
  const m0 = now.getMonth()
  const daysInMonth = new Date(y, m0 + 1, 0).getDate()
  const dayOfMonth = now.getDate()
  const daysLeftInMonth = Math.max(1, daysInMonth - dayOfMonth + 1)

  const rawPlanned = parseNumberLoose(plannedIncomeMonth)
  const baseIncomeForTips = Number.isFinite(rawPlanned) && rawPlanned > 0 ? rawPlanned : incomeMonth

  const spendableMonthBeforeSaving = Math.max(0, baseIncomeForTips - usnReserve - loansPlannedMonth - ipReserveMonth)
  const allowedSpendMonth = Math.max(0, spendableMonthBeforeSaving - targetMonthly)

  const avgSpendPerDay = allowedSpendMonth / daysInMonth
  const remainingSpendMonth = allowedSpendMonth - expenseMonth
  const allowedSpendPerDayFromToday = remainingSpendMonth / daysLeftInMonth

  const remainingSaveThisMonth = Math.max(0, targetMonthly - savedThisMonth)
  const savePerDayFromToday = remainingSaveThisMonth / daysLeftInMonth
  const avgSavePerDay = targetMonthly / daysInMonth

  // ✅ ТВОЙ ЗАПРОС: “остаток сейчас” = доход - расход
  const balanceNowThisMonth = incomeMonth - expenseMonth

  // ✅ “Свободно” = остаток сейчас - резервы/обязательное - уже отложено
  const freeMoney = balanceNowThisMonth - usnReserve - loansPlannedMonth - ipReserveMonth - savedThisMonth

  return (
    <main style={ui.page}>
      <div style={ui.headerRow}>
        <div style={{ minWidth: 0 }}>
          <h1 style={ui.h1}>Финансы Карина — копилка + контроль трат</h1>
          <div style={ui.sub}>
            Сейчас: <b style={{ textTransform: 'capitalize' }}>{headerMonthYear}</b> • Сегодня: <b>{headerToday}</b>
          </div>
        </div>

        <button onClick={loadAll} disabled={loading} style={{ ...ui.btnPrimary, opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Обновляю…' : 'Обновить'}
        </button>
      </div>

      {/* TIPS */}
      <section style={{ ...ui.card, marginTop: 14 }}>
        <div style={{ ...ui.row, alignItems: 'flex-start' }}>
          <div style={{ flex: '2 1 520px', minWidth: 260 }}>
            <div style={{ ...ui.cardTitle, marginBottom: 8 }}>🧠 Рекомендации на месяц (чтобы накопить)</div>

            {/* ✅ добавили доход/расход/остаток */}
            <div style={{ ...ui.row, marginBottom: 8 }}>
              <span style={ui.pill}>Доход (месяц): <b>{money(incomeMonth)}</b></span>
              <span style={ui.pill}>Расход (месяц): <b>{money(expenseMonth)}</b></span>
              <span style={ui.pill}>Остаток сейчас: <b>{money(balanceNowThisMonth)}</b></span>
            </div>

            <div style={{ ...ui.row, marginBottom: 8 }}>
              <span style={ui.pill}>Доход для расчёта: <b>{money(baseIncomeForTips)}</b></span>
              <span style={ui.pill}>
                Обязательное: УСН {money(usnReserve)} • кредиты {money(loansPlannedMonth)} • взносы {money(ipReserveMonth)}
              </span>
            </div>

            <div style={{ opacity: 0.9, lineHeight: 1.5 }}>
              <div>
                Хочешь отложить в месяц: <b>{money(targetMonthly)}</b> (в этом месяце уже: <b>{money(savedThisMonth)}</b>)
              </div>

              <div style={{ marginTop: 6 }}>
                Тогда траты в месяц должны быть не больше: <b>{money(allowedSpendMonth)}</b>
              </div>

              <div style={{ marginTop: 6 }}>
                ✅ Средний лимит трат в день: <b>{money(avgSpendPerDay)}</b>
              </div>

              <div style={{ marginTop: 6 }}>
                ✅ Лимит трат “сегодня и дальше” (на остаток месяца): <b>{money(allowedSpendPerDayFromToday)}</b>
              </div>

              <div style={ui.divider} />

              <div>
                Чтобы выполнить накопление: в среднем <b>{money(avgSavePerDay)}</b> в день
              </div>
              <div style={{ marginTop: 6 }}>
                Чтобы добить план в этом месяце: с сегодняшнего дня по <b>{money(savePerDayFromToday)}</b> в день
              </div>

              <div style={{ marginTop: 12 }}>
                <button
                  onClick={() => addRecommendedToday(savePerDayFromToday)}
                  style={{ ...ui.btnPrimary, width: '100%' }}
                >
                  ➕ Внести сегодня рекомендованную сумму ({money(Math.round(savePerDayFromToday))})
                </button>
              </div>

              <div style={{ marginTop: 10 }}>
                Свободно (после трат, обязательного и копилки): <b>{money(freeMoney)}</b>
              </div>
            </div>
          </div>

          <div style={{ flex: '1 1 320px', minWidth: 260, maxWidth: 420 }}>
            <div style={{ ...ui.cardTitle, marginBottom: 8 }}>План дохода на месяц</div>
            <input
              style={ui.input}
              value={plannedIncomeMonth}
              onChange={e => setPlannedIncomeMonth(e.target.value)}
              placeholder="например 600000"
            />
            <div style={{ ...ui.small, marginTop: 6 }}>
              Если пусто — считаю по факту доходов.
            </div>
          </div>
        </div>
      </section>

      <div style={ui.grid}>
        {/* Savings / goal */}
        <section style={ui.card}>
          <div style={{ ...ui.row, alignItems: 'flex-start' }}>
            <div style={{ flex: '2 1 520px', minWidth: 260 }}>
              <div style={ui.cardTitle}>🎯 Копилка и цель</div>

              <div style={{ ...ui.row, marginBottom: 10 }}>
                <span style={ui.pill}>В копилке всего: <b>{money(totalSavedAll)}</b></span>
                <span style={ui.pill}>Осталось до цели: <b>{money(remainingToGoal)}</b></span>
                {estMonths !== null ? <span style={ui.pill}>Месяцев до цели: <b>{estMonths}</b></span> : null}
              </div>

              <div style={ui.progressWrap}>
                <div style={ui.progressBar(goalPct)} />
              </div>
              <div style={{ ...ui.small, marginTop: 6 }}>{Math.round(goalPct)}% от цели</div>

              <div style={ui.divider} />

              <div style={{ ...ui.cards, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div>
                  <div style={{ ...ui.small, marginBottom: 6 }}>Цель (₽)</div>
                  <input style={ui.input} value={goalInput} onChange={e => setGoalInput(e.target.value)} placeholder="1000000" />
                </div>
                <div>
                  <div style={{ ...ui.small, marginBottom: 6 }}>Хочу откладывать в месяц (₽)</div>
                  <input style={ui.input} value={targetMonthlyInput} onChange={e => setTargetMonthlyInput(e.target.value)} placeholder="например 50000" />
                </div>
                <div style={{ alignSelf: 'end' }}>
                  <button style={{ ...ui.btnPrimary, width: '100%' }} onClick={saveSavingsSettings}>
                    Сохранить настройки копилки
                  </button>
                </div>
              </div>
            </div>

            <div style={{ flex: '1 1 360px', minWidth: 260, maxWidth: 520 }}>
              <div style={ui.cardTitle}>➕ Внести в копилку</div>
              <form onSubmit={addSavingsEntry} style={{ display: 'grid', gap: 8 }}>
                <input type="date" style={ui.input as any} value={saveDate} onChange={e => setSaveDate(e.target.value)} />
                <input style={ui.input} value={saveAmount} onChange={e => setSaveAmount(e.target.value)} placeholder="Сумма, ₽" />
                <input style={ui.input} value={saveNote} onChange={e => setSaveNote(e.target.value)} placeholder="Комментарий (необязательно)" />
                <button type="submit" style={{ ...ui.btnPrimary, width: '100%' }}>Добавить взнос</button>
              </form>
            </div>
          </div>

          <div style={ui.divider} />

          <div style={{ fontWeight: 900, marginBottom: 8 }}>История копилки</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {savingsEntries.length === 0 ? (
              <div style={{ opacity: 0.75 }}>Пока пусто.</div>
            ) : (
              savingsEntries.slice(0, 25).map(s => {
                const isEdit = editingSaveId === s.id
                return (
                  <div
                    key={s.id}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      border: '1px solid rgba(255,255,255,0.10)',
                      background: 'rgba(0,0,0,0.22)',
                    }}
                  >
                    {!isEdit ? (
                      <div style={ui.row}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <b>{s.date}</b> • <b>{money(s.amount)}</b>
                          {s.note ? <span style={{ opacity: 0.7 }}> • {s.note}</span> : null}
                          <div style={ui.small}>Добавлено: {fmtDateTimeRu(s.created_at)}</div>
                        </div>
                        <button style={ui.btn} onClick={() => startEditSave(s)}>Редактировать</button>
                        <button style={ui.btn} onClick={() => deleteSave(s)}>Удалить</button>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontWeight: 900, marginBottom: 8 }}>Редактирование взноса</div>
                        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                          <input type="date" style={ui.input as any} value={saveEditDate} onChange={e => setSaveEditDate(e.target.value)} />
                          <input style={ui.input} value={saveEditAmount} onChange={e => setSaveEditAmount(e.target.value)} placeholder="Сумма" />
                          <input style={ui.input} value={saveEditNote} onChange={e => setSaveEditNote(e.target.value)} placeholder="Комментарий" />
                        </div>
                        <div style={{ ...ui.row, marginTop: 10 }}>
                          <button style={ui.btnPrimary} onClick={() => saveEditSave(s)}>Сохранить</button>
                          <button style={ui.btn} onClick={() => setEditingSaveId('')}>Отмена</button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* Add income/expense + loans */}
        <section style={ui.card}>
          <div style={ui.cardTitle}>Добавление (доход / расход / кредиты)</div>

          <datalist id="income-cats">
            {incomeCategories.map(c => <option key={c} value={c} />)}
          </datalist>
          <datalist id="expense-cats">
            {expenseCategories.map(c => <option key={c} value={c} />)}
          </datalist>

          <div style={ui.cards}>
            <form onSubmit={submitIncome} style={ui.card}>
              <div style={ui.cardTitle}>+ Доход</div>
              <div style={{ display: 'grid', gap: 8 }}>
                <input type="date" value={incomeDate} onChange={e => setIncomeDate(e.target.value)} style={ui.input as any} />
                <input value={incomeAmount} onChange={e => setIncomeAmount(e.target.value)} placeholder="Сумма, ₽" style={ui.input} />
                <input list="income-cats" value={incomeCategory} onChange={e => setIncomeCategory(e.target.value)} placeholder="Категория" style={ui.input} />
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, opacity: 0.95 }}>
                  <input type="checkbox" checked={incomeTaxable} onChange={e => setIncomeTaxable(e.target.checked)} />
                  Облагается УСН 6%
                </label>
                <input value={incomeNote} onChange={e => setIncomeNote(e.target.value)} placeholder="Комментарий (необязательно)" style={ui.input} />
                <button type="submit" style={{ ...ui.btnPrimary, width: '100%' }}>Добавить доход</button>
              </div>
            </form>

            <form onSubmit={submitExpense} style={ui.card}>
              <div style={ui.cardTitle}>- Расход</div>
              <div style={{ display: 'grid', gap: 8 }}>
                <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} style={ui.input as any} />
                <input value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="Сумма, ₽" style={ui.input} />
                <input list="expense-cats" value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)} placeholder="Категория" style={ui.input} />
                <input value={expenseNote} onChange={e => setExpenseNote(e.target.value)} placeholder="Комментарий (необязательно)" style={ui.input} />
                <button type="submit" style={{ ...ui.btnPrimary, width: '100%' }}>Добавить расход</button>
              </div>
            </form>

            <form onSubmit={submitLoan} style={ui.card}>
              <div style={ui.cardTitle}>+ Кредит</div>
              <div style={{ display: 'grid', gap: 8 }}>
                <input value={loanTitle} onChange={e => setLoanTitle(e.target.value)} placeholder="Название (Тинькофф…)" style={ui.input} />
                <input value={loanBalance} onChange={e => setLoanBalance(e.target.value)} placeholder="Остаток долга, ₽" style={ui.input} />
                <input value={loanMonthly} onChange={e => setLoanMonthly(e.target.value)} placeholder="Ежемесячный платёж, ₽" style={ui.input} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input value={loanDay} onChange={e => setLoanDay(e.target.value)} placeholder="День (1–28)" style={ui.input} />
                  <input value={loanRate} onChange={e => setLoanRate(e.target.value)} placeholder="Ставка, %" style={ui.input} />
                </div>
                <button type="submit" style={{ ...ui.btnPrimary, width: '100%' }}>Добавить кредит</button>
              </div>
            </form>

            <form onSubmit={submitLoanPayment} style={ui.card}>
              <div style={ui.cardTitle}>Отметить платёж по кредиту</div>
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
          </div>
        </section>

        {/* Transactions list */}
        <section style={ui.card}>
          <div style={ui.cardTitle}>Операции (редактирование + даты)</div>

          <div style={{ display: 'grid', gap: 8 }}>
            {rows.map(r => {
              const t = normTxType(r.type)
              const isEditing = editingTxId === r.id
              const catsId = t === 'income' ? 'income-cats' : 'expense-cats'

              return (
                <div
                  key={r.id}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.10)',
                    background: 'rgba(0,0,0,0.22)',
                  }}
                >
                  {!isEditing ? (
                    <div style={ui.row}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b>{t === 'expense' ? 'Расход' : 'Доход'}</b> • {r.category} {t === 'income' && r.taxable_usn ? '• УСН' : ''}
                        {r.note ? <span style={{ opacity: 0.7 }}> • {r.note}</span> : null}
                        <div style={ui.small}>
                          Дата операции: <b>{r.date}</b> • Добавлено: {fmtDateTimeRu(r.created_at)}
                        </div>
                      </div>

                      <div style={{ fontWeight: 900 }}>{money(r.amount)}</div>
                      <button style={ui.btn} onClick={() => startEditTx(r)}>Редактировать</button>
                      <button style={ui.btn} onClick={() => deleteTx(r)}>Удалить</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontWeight: 900, marginBottom: 8 }}>
                        Редактирование: {t === 'expense' ? 'расход' : 'доход'}
                      </div>

                      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                        <input type="date" value={txEditDate} onChange={e => setTxEditDate(e.target.value)} style={ui.input as any} />
                        <input value={txEditAmount} onChange={e => setTxEditAmount(e.target.value)} placeholder="Сумма" style={ui.input} />
                        <input list={catsId} value={txEditCategory} onChange={e => setTxEditCategory(e.target.value)} placeholder="Категория" style={ui.input} />
                        <input value={txEditNote} onChange={e => setTxEditNote(e.target.value)} placeholder="Комментарий" style={ui.input} />
                        {t === 'income' ? (
                          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                            <input type="checkbox" checked={txEditTaxable} onChange={e => setTxEditTaxable(e.target.checked)} />
                            Облагается УСН 6%
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
      </div>
    </main>
  )
}

