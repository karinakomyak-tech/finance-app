'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../lib/supabase'

type Transaction = {
  id: string
  date: string
  type: 'income' | 'expense'
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

type TabKey = 'overview' | 'tx' | 'fixed' | 'savings' | 'history'

const ui = {
  page: {
    padding: 16,
    paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    maxWidth: 1120,
    margin: '0 auto',
    color: '#f3f3f3',
  } as CSSProperties,

  topbar: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: 'rgba(10,10,10,0.86)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  } as CSSProperties,

  topbarInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 16px',
    maxWidth: 1120,
    margin: '0 auto',
  } as CSSProperties,

  burger: {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
    fontSize: 20,
  } as CSSProperties,

  titleWrap: { minWidth: 0 } as CSSProperties,
  h1: { fontSize: 18, fontWeight: 900, margin: 0, lineHeight: '22px' } as CSSProperties,
  sub: { opacity: 0.78, marginTop: 4, fontSize: 12 } as CSSProperties,

  btnPrimary: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.25)',
    background: 'rgba(255,255,255,0.14)',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: 16,
    whiteSpace: 'nowrap',
  } as CSSProperties,

  grid: { display: 'grid', gap: 12, marginTop: 14 } as CSSProperties,

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

  // Drawer
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    zIndex: 50,
  } as CSSProperties,

  drawer: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    width: 'min(320px, 86vw)',
    background: 'rgba(12,12,12,0.96)',
    backdropFilter: 'blur(10px)',
    borderRight: '1px solid rgba(255,255,255,0.10)',
    zIndex: 60,
    padding: 14,
    display: 'grid',
    gridTemplateRows: 'auto 1fr auto',
    gap: 12,
  } as CSSProperties,

  navBtn: (active: boolean) =>
    ({
      width: '100%',
      padding: '12px 12px',
      borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.10)',
      background: active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)',
      color: '#fff',
      cursor: 'pointer',
      textAlign: 'left',
      fontWeight: 800,
      fontSize: 16,
    }) as CSSProperties,
}

export default function Home() {
  const today = toDateOnly(new Date())

  // UI
  const [tab, setTab] = useState<TabKey>('overview')
  const [drawerOpen, setDrawerOpen] = useState(false)

  // data
  const [rows, setRows] = useState<Transaction[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [loanPayments, setLoanPayments] = useState<Record<string, LoanPayment[]>>({})
  const [savingsSettings, setSavingsSettings] = useState<SavingsSettings | null>(null)
  const [savingsEntries, setSavingsEntries] = useState<SavingsEntry[]>([])
  const [loading, setLoading] = useState(false)

  // forms
  const [incomeDate, setIncomeDate] = useState(today)
  const [incomeAmount, setIncomeAmount] = useState('')
  const [incomeCategory, setIncomeCategory] = useState('Основной доход')
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

  // planned income (local)
  const [plannedIncomeMonth, setPlannedIncomeMonth] = useState<string>('')

  // ---------- load ----------
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
    await Promise.all([loadTransactions(), loadLoans(), loadLoanPayments(), ensureSavingsSettingsRow(), loadSavingsEntries()])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  // localStorage planned income
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

  // categories
  const incomeCategories = useMemo(() => {
    const set = new Set(rows.filter(r => r.type === 'income').map(r => (r.category || '').trim()).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [rows])

  const expenseCategories = useMemo(() => {
    const set = new Set(rows.filter(r => r.type === 'expense').map(r => (r.category || '').trim()).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [rows])

  // ---------- actions ----------
  async function submitIncome(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseNumberLoose(incomeAmount)
    if (!Number.isFinite(amount) || amount <= 0) return alert('Некорректная сумма дохода')

    const { error } = await supabase.from('transactions').insert({
      date: incomeDate,
      type: 'income',
      amount,
      category: incomeCategory.trim() || 'Доход',
      taxable_usn: null, // УСН убрали
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

  // ✅ ВАЖНО: при оплате кредита — записываем И в loan_payments, И в расходы transactions
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

    // 1) обновляем loan
    const { error: updErr } = await supabase
      .from('loans')
      .update({ balance: balance_after, active, last_payment_date: payLoanDate })
      .eq('id', loan.id)
    if (updErr) return alert(updErr.message)

    // 2) пишем loan_payments
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

    // 3) пишем в expenses
    const { error: txErr } = await supabase.from('transactions').insert({
      date: payLoanDate,
      type: 'expense',
      amount: payment_amount,
      category: `Кредит: ${loan.title}`,
      taxable_usn: null,
      note: `Проценты: ${Math.round(interest_amount)} ₽ • Тело: ${Math.round(principal_amount)} ₽`,
    })
    if (txErr) return alert('Не смогла записать расход по кредиту: ' + txErr.message)

    setPayLoanAmount('')
    await Promise.all([loadLoans(), loadLoanPayments(), loadTransactions()])

    alert(
      `Платёж сохранён.\nДней: ${days}\nПроценты: ${money(interest_amount)}\nВ тело: ${money(principal_amount)}\nОстаток: ${money(balance_after)}`
    )
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

  // ---------- calculations (НОВАЯ верхняя панель: реальный остаток) ----------
  const now = new Date()
  const currentMonth = now.toISOString().slice(0, 7)

  const headerMonthYear = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(now)
  const headerToday = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(now)

  const incomeMonth = useMemo(
    () => rows.filter(r => r.type === 'income' && r.date.startsWith(currentMonth)).reduce((s, r) => s + Number(r.amount), 0),
    [rows, currentMonth]
  )
  const expenseMonth = useMemo(
    () => rows.filter(r => r.type === 'expense' && r.date.startsWith(currentMonth)).reduce((s, r) => s + Number(r.amount), 0),
    [rows, currentMonth]
  )

  const loansPlannedMonth = useMemo(() => loans.filter(l => l.active).reduce((s, l) => s + Number(l.monthly_payment), 0), [loans])

  const totalSavedAll = useMemo(() => savingsEntries.reduce((s, e) => s + Number(e.amount), 0), [savingsEntries])
  const savedThisMonth = useMemo(
    () => savingsEntries.filter(e => e.date.startsWith(currentMonth)).reduce((s, e) => s + Number(e.amount), 0),
    [savingsEntries, currentMonth]
  )

  const goal = Number(savingsSettings?.goal_amount ?? 1000000)
  const targetMonthly = Number(savingsSettings?.target_monthly ?? 0)

  const goalPct = goal > 0 ? (totalSavedAll / goal) * 100 : 0
  const remainingToGoal = Math.max(0, goal - totalSavedAll)

  // дни
  const y = now.getFullYear()
  const m0 = now.getMonth()
  const daysInMonth = new Date(y, m0 + 1, 0).getDate()
  const dayOfMonth = now.getDate()
  const daysLeftInMonth = Math.max(1, daysInMonth - dayOfMonth + 1)

  const rawPlanned = parseNumberLoose(plannedIncomeMonth)
  const baseIncomeForTips = Number.isFinite(rawPlanned) && rawPlanned > 0 ? rawPlanned : incomeMonth

  // ✅ РЕАЛЬНЫЙ остаток за месяц прямо сейчас:
  const realBalanceNow = incomeMonth - expenseMonth - savedThisMonth

  // ✅ Лимит трат: от остатка/плана минус копилка (и без УСН)
  const allowedSpendMonth = Math.max(0, baseIncomeForTips - loansPlannedMonth - targetMonthly)
  const remainingSpendMonth = allowedSpendMonth - expenseMonth
  const allowedSpendPerDayFromToday = remainingSpendMonth / daysLeftInMonth

  const avgSpendPerDay = allowedSpendMonth / daysInMonth

  // ---------- drawer helpers ----------
  const navItems: Array<{ key: TabKey; title: string; desc: string }> = [
    { key: 'overview', title: 'Обзор', desc: 'остаток, лимиты, план' },
    { key: 'tx', title: 'Доходы/Расходы', desc: 'добавление операций' },
    { key: 'fixed', title: 'Постоянные', desc: 'кредиты/кредитки (скоро)' },
    { key: 'savings', title: 'Копилка', desc: 'цель, взносы' },
    { key: 'history', title: 'История', desc: 'все операции' },
  ]

  function openTab(k: TabKey) {
    setTab(k)
    setDrawerOpen(false)
  }

  return (
    <>
      {/* TOPBAR */}
      <div style={ui.topbar}>
        <div style={ui.topbarInner}>
          <button style={ui.burger} onClick={() => setDrawerOpen(true)} aria-label="Меню">
            ☰
          </button>

          <div style={ui.titleWrap}>
            <div style={ui.h1}>Финансы Карина</div>
            <div style={ui.sub}>
              <span style={{ textTransform: 'capitalize' }}>{headerMonthYear}</span> • {headerToday}
            </div>
          </div>

          <button onClick={loadAll} disabled={loading} style={{ ...ui.btnPrimary, opacity: loading ? 0.6 : 1 }}>
            {loading ? '…' : 'Обновить'}
          </button>
        </div>
      </div>

      {/* DRAWER */}
      {drawerOpen ? (
        <>
          <div style={ui.overlay} onClick={() => setDrawerOpen(false)} />
          <aside style={ui.drawer}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Меню</div>
              <div style={{ opacity: 0.75, fontSize: 12, marginTop: 4 }}>Выбирай раздел</div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {navItems.map(it => (
                <button key={it.key} style={ui.navBtn(tab === it.key)} onClick={() => openTab(it.key)}>
                  {it.title}
                  <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>{it.desc}</div>
                </button>
              ))}
            </div>

            <button style={ui.btn} onClick={() => setDrawerOpen(false)}>
              Закрыть
            </button>
          </aside>
        </>
      ) : null}

      <main style={ui.page}>
        {/* OVERVIEW */}
        {tab === 'overview' ? (
          <section style={ui.card}>
            <div style={ui.cardTitle}>📌 Сейчас (реальный остаток)</div>
            <div style={ui.cards}>
              <div style={ui.card}>
                <div style={ui.small}>Доходы за месяц</div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>{money(incomeMonth)}</div>
              </div>

              <div style={ui.card}>
                <div style={ui.small}>Расходы за месяц</div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>{money(expenseMonth)}</div>
              </div>

              <div style={ui.card}>
                <div style={ui.small}>В копилку (месяц)</div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>{money(savedThisMonth)}</div>
              </div>

              <div style={ui.card}>
                <div style={ui.small}>Остаток сейчас</div>
                <div style={{ fontWeight: 900, fontSize: 26 }}>{money(realBalanceNow)}</div>
                <div style={{ ...ui.small, marginTop: 6 }}>Доходы − расходы − копилка</div>
              </div>
            </div>

            <div style={ui.divider} />

            <div style={ui.cardTitle}>🧠 Лимиты трат (с учётом копилки)</div>
            <div style={{ ...ui.row, marginBottom: 10 }}>
              <span style={ui.pill}>План дохода: <b>{money(baseIncomeForTips)}</b></span>
              <span style={ui.pill}>Хочу в копилку: <b>{money(targetMonthly)}</b></span>
              <span style={ui.pill}>План кредитов: <b>{money(loansPlannedMonth)}</b></span>
            </div>

            <div style={{ lineHeight: 1.55, opacity: 0.92 }}>
              <div>Траты в месяц не больше: <b>{money(allowedSpendMonth)}</b></div>
              <div style={{ marginTop: 6 }}>Средний лимит в день: <b>{money(avgSpendPerDay)}</b></div>
              <div style={{ marginTop: 6 }}>Лимит “сегодня и дальше”: <b>{money(allowedSpendPerDayFromToday)}</b></div>
            </div>

            <div style={ui.divider} />

            <div style={ui.cardTitle}>🎯 Цель копилки</div>
            <div style={{ ...ui.row, marginBottom: 10 }}>
              <span style={ui.pill}>В копилке всего: <b>{money(totalSavedAll)}</b></span>
              <span style={ui.pill}>Осталось: <b>{money(remainingToGoal)}</b></span>
            </div>
            <div style={ui.progressWrap}>
              <div style={ui.progressBar(goalPct)} />
            </div>
            <div style={{ ...ui.small, marginTop: 6 }}>{Math.round(goalPct)}% от цели</div>

            <div style={ui.divider} />

            <div style={ui.cardTitle}>План дохода на месяц</div>
            <input
              style={ui.input}
              value={plannedIncomeMonth}
              onChange={e => setPlannedIncomeMonth(e.target.value)}
              placeholder="например 600000"
            />
            <div style={{ ...ui.small, marginTop: 6 }}>Если пусто — считаю по факту доходов.</div>
          </section>
        ) : null}

        {/* TX */}
        {tab === 'tx' ? (
          <section style={ui.card}>
            <div style={ui.cardTitle}>➕ Доходы / Расходы</div>

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
            </div>

            <div style={ui.divider} />

            <div style={ui.cardTitle}>🏦 Кредиты (пока как есть)</div>

            <div style={ui.cards}>
              <form onSubmit={submitLoan} style={ui.card}>
                <div style={ui.cardTitle}>+ Добавить кредит</div>
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
                <div style={ui.cardTitle}>Отметить платёж</div>
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

            <div style={ui.divider} />
            <div style={ui.small}>
              ✅ Платёж по кредиту теперь автоматически записывается в расходы (transactions).
            </div>
          </section>
        ) : null}

        {/* FIXED (заглушка, следующий шаг) */}
        {tab === 'fixed' ? (
          <section style={ui.card}>
            <div style={ui.cardTitle}>🧾 Постоянные расходы</div>
            <div style={{ opacity: 0.85, lineHeight: 1.6 }}>
              Здесь мы следующим шагом сделаем:
              <ul style={{ marginTop: 8 }}>
                <li>единый список: кредиты + кредитки + подписки</li>
                <li>кнопку «Оплачено» — только после неё расход попадает в операции</li>
                <li>перенос по месяцам и “остаток переносится”</li>
              </ul>
            </div>
          </section>
        ) : null}

        {/* SAVINGS */}
        {tab === 'savings' ? (
          <section style={ui.card}>
            <div style={ui.cardTitle}>🎯 Копилка</div>

            <div style={ui.cards}>
              <div style={ui.card}>
                <div style={{ ...ui.row, marginBottom: 10 }}>
                  <span style={ui.pill}>В копилке всего: <b>{money(totalSavedAll)}</b></span>
                  <span style={ui.pill}>Осталось до цели: <b>{money(remainingToGoal)}</b></span>
                </div>

                <div style={ui.progressWrap}>
                  <div style={ui.progressBar(goalPct)} />
                </div>
                <div style={{ ...ui.small, marginTop: 6 }}>{Math.round(goalPct)}% от цели</div>

                <div style={ui.divider} />

                <div style={{ display: 'grid', gap: 8 }}>
                  <div>
                    <div style={ui.small}>Цель (₽)</div>
                    <input style={ui.input} value={goalInput} onChange={e => setGoalInput(e.target.value)} />
                  </div>
                  <div>
                    <div style={ui.small}>Хочу откладывать в месяц (₽)</div>
                    <input style={ui.input} value={targetMonthlyInput} onChange={e => setTargetMonthlyInput(e.target.value)} />
                  </div>
                  <button style={{ ...ui.btnPrimary, width: '100%' }} onClick={saveSavingsSettings}>
                    Сохранить настройки
                  </button>
                </div>
              </div>

              <div style={ui.card}>
                <div style={ui.cardTitle}>➕ Внести</div>
                <form onSubmit={addSavingsEntry} style={{ display: 'grid', gap: 8 }}>
                  <input type="date" style={ui.input as any} value={saveDate} onChange={e => setSaveDate(e.target.value)} />
                  <input style={ui.input} value={saveAmount} onChange={e => setSaveAmount(e.target.value)} placeholder="Сумма, ₽" />
                  <input style={ui.input} value={saveNote} onChange={e => setSaveNote(e.target.value)} placeholder="Комментарий (необязательно)" />
                  <button type="submit" style={{ ...ui.btnPrimary, width: '100%' }}>Добавить</button>
                </form>
              </div>
            </div>

            <div style={ui.divider} />

            <div style={{ fontWeight: 900, marginBottom: 8 }}>История (последние 25)</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {savingsEntries.slice(0, 25).map(s => (
                <div
                  key={s.id}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.10)',
                    background: 'rgba(0,0,0,0.22)',
                  }}
                >
                  <b>{s.date}</b> • <b>{money(Number(s.amount))}</b>
                  {s.note ? <span style={{ opacity: 0.7 }}> • {s.note}</span> : null}
                  <div style={ui.small}>Добавлено: {fmtDateTimeRu(s.created_at)}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* HISTORY */}
        {tab === 'history' ? (
          <section style={ui.card}>
            <div style={ui.cardTitle}>📚 История операций</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {rows.map(r => (
                <div
                  key={r.id}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.10)',
                    background: 'rgba(0,0,0,0.22)',
                  }}
                >
                  <div style={ui.row}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{r.type === 'expense' ? 'Расход' : 'Доход'}</b> • {r.category}
                      {r.note ? <span style={{ opacity: 0.7 }}> • {r.note}</span> : null}
                      <div style={ui.small}>
                        Дата: <b>{r.date}</b> • Добавлено: {fmtDateTimeRu(r.created_at)}
                      </div>
                    </div>
                    <div style={{ fontWeight: 900 }}>{money(Number(r.amount))}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </>
  )
}