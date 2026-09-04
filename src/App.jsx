import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const [mode, setMode] = useState(null)

  if (loading) return <div className="center">Loading…</div>

  return (
    <div className="app">
      <header className="topbar">
        <h1>🏦 Bank of Letize</h1>
        {session && mode === 'parent' && (
          <button className="link" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        )}
      </header>

      {!mode && !session && <ModeSelect onSelect={setMode} />}
      {mode === 'kid' && <KidView onBack={() => setMode(null)} />}
      {(mode === 'parent' || session) &&
        (session ? <Dashboard /> : <Auth onBack={() => setMode(null)} />)}
    </div>
  )
}

function ModeSelect({ onSelect }) {
  return (
    <div className="card mode-select">
      <button className="mode-btn" onClick={() => onSelect('parent')}>
        👪 Parent sign in
      </button>
      <button className="mode-btn" onClick={() => onSelect('kid')}>
        🧒 View my account
      </button>
    </div>
  )
}

function Auth({ onBack }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('signin')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setInfo('Account created. Check your email to confirm, then sign in.')
    }
  }

  return (
    <div className="card auth-card">
      {onBack && (
        <button className="link" onClick={onBack}>
          ← Back
        </button>
      )}
      <h2>{mode === 'signin' ? 'Parent sign in' : 'Create parent account'}</h2>
      <form onSubmit={handleSubmit} className="form">
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        {info && <p className="info">{info}</p>}
        <button type="submit">{mode === 'signin' ? 'Sign in' : 'Sign up'}</button>
      </form>
      <button className="link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        {mode === 'signin' ? "Need an account? Sign up" : 'Already have an account? Sign in'}
      </button>
    </div>
  )
}

function Dashboard() {
  const [kids, setKids] = useState([])
  const [selectedKid, setSelectedKid] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadKids() {
    setLoading(true)
    const { data, error } = await supabase.from('kids').select('*').order('created_at')
    if (!error) setKids(data)
    setLoading(false)
  }

  useEffect(() => {
    loadKids()
  }, [])

  if (loading) return <div className="center">Loading accounts…</div>

  if (selectedKid) {
    return (
      <KidDetail
        kid={selectedKid}
        onBack={() => {
          setSelectedKid(null)
          loadKids()
        }}
      />
    )
  }

  return (
    <div className="dashboard">
      <div className="kid-grid">
        {kids.map((kid) => (
          <div className="kid-card" key={kid.id}>
            <button className="kid-card-main" onClick={() => setSelectedKid(kid)}>
              <div className="kid-name">{kid.name}</div>
              <div className="kid-balance">${Number(kid.balance).toFixed(2)}</div>
              <div className="kid-rate">{kid.interest_rate}% annual interest</div>
            </button>
            <div className="kid-code">
              View code: <strong>{kid.kid_access_code}</strong>
            </div>
          </div>
        ))}
      </div>
      <AddKid onAdded={loadKids} />
    </div>
  )
}

function normalizeCode(val) {
  return val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
}

function AddKid({ onAdded }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [rate, setRate] = useState('0')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const trimmedCode = code.trim().toUpperCase()
    if (!trimmedCode) {
      setError('Please enter a view code.')
      return
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error } = await supabase.from('kids').insert({
      name,
      interest_rate: Number(rate) || 0,
      parent_id: user.id,
      kid_access_code: trimmedCode,
    })
    if (error) {
      setError(error.message.includes('unique') ? 'That code is already in use. Choose a different one.' : error.message)
      return
    }
    setName('')
    setRate('0')
    setCode('')
    setOpen(false)
    onAdded()
  }

  if (!open) {
    return (
      <button className="add-kid-btn" onClick={() => setOpen(true)}>
        + Add kid account
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="card form">
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Annual interest rate (%)
        <input type="number" step="0.1" value={rate} onChange={(e) => setRate(e.target.value)} />
      </label>
      <label>
        View code{' '}
        <span style={{ fontWeight: 400, color: '#888' }}>(letters &amp; numbers, what your kid types to log in)</span>
        <input
          value={code}
          onChange={(e) => setCode(normalizeCode(e.target.value))}
          placeholder="e.g. EMMA or 1234"
          required
          autoCapitalize="characters"
        />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit">Create account</button>
        <button type="button" className="secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function KidDetail({ kid, onBack }) {
  const [transactions, setTransactions] = useState([])
  const [balance, setBalance] = useState(kid.balance)
  const [loading, setLoading] = useState(true)

  const [editingRate, setEditingRate] = useState(false)
  const [newRate, setNewRate] = useState(String(kid.interest_rate))
  const [currentRate, setCurrentRate] = useState(kid.interest_rate)

  const [editingCode, setEditingCode] = useState(false)
  const [newCode, setNewCode] = useState(kid.kid_access_code || '')
  const [currentCode, setCurrentCode] = useState(kid.kid_access_code || '')
  const [codeError, setCodeError] = useState('')

  const [editingTxId, setEditingTxId] = useState(null)
  const [editTxKind, setEditTxKind] = useState('deposit')
  const [editTxAmount, setEditTxAmount] = useState('')
  const [editTxNote, setEditTxNote] = useState('')

  async function refresh() {
    setLoading(true)
    const { data: k } = await supabase.from('kids').select('*').eq('id', kid.id).single()
    if (k) {
      setBalance(k.balance)
      setCurrentRate(k.interest_rate)
      setNewRate(String(k.interest_rate))
      setCurrentCode(k.kid_access_code || '')
      setNewCode(k.kid_access_code || '')
    }
    const { data: txs } = await supabase
      .from('transactions')
      .select('*')
      .eq('kid_id', kid.id)
      .order('created_at', { ascending: false })
    setTransactions(txs || [])
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  async function addTransaction(amount, note, type = 'manual') {
    await supabase.from('transactions').insert({ kid_id: kid.id, amount, note, type })
    refresh()
  }

  async function applyMonthlyInterest() {
    const monthlyInterest = (balance * (currentRate / 100)) / 12
    if (monthlyInterest <= 0) return
    await addTransaction(Number(monthlyInterest.toFixed(2)), 'Monthly interest', 'interest')
  }

  async function saveInterestRate(e) {
    e.preventDefault()
    await supabase.from('kids').update({ interest_rate: Number(newRate) }).eq('id', kid.id)
    setCurrentRate(Number(newRate))
    setEditingRate(false)
  }

  async function saveCode(e) {
    e.preventDefault()
    setCodeError('')
    const trimmed = newCode.trim().toUpperCase()
    if (!trimmed) { setCodeError('Code cannot be empty.'); return }
    const { error } = await supabase.from('kids').update({ kid_access_code: trimmed }).eq('id', kid.id)
    if (error) {
      setCodeError(error.message.includes('unique') ? 'That code is already in use.' : error.message)
      return
    }
    setCurrentCode(trimmed)
    setNewCode(trimmed)
    setEditingCode(false)
  }

  function startEditTx(tx) {
    setEditingTxId(tx.id)
    setEditTxKind(Number(tx.amount) >= 0 ? 'deposit' : 'withdrawal')
    setEditTxAmount(String(Math.abs(Number(tx.amount))))
    setEditTxNote(tx.note || '')
  }

  async function saveEditTx(e, tx) {
    e.preventDefault()
    const newAmount = editTxKind === 'deposit'
      ? Math.abs(Number(editTxAmount))
      : -Math.abs(Number(editTxAmount))
    const diff = newAmount - Number(tx.amount)
    await supabase.from('transactions').update({ amount: newAmount, note: editTxNote }).eq('id', tx.id)
    await supabase.from('kids').update({ balance: Number(balance) + diff }).eq('id', kid.id)
    setEditingTxId(null)
    refresh()
  }

  async function deleteTx(tx) {
    if (!window.confirm('Delete this transaction?')) return
    await supabase.from('transactions').delete().eq('id', tx.id)
    await supabase.from('kids').update({ balance: Number(balance) - Number(tx.amount) }).eq('id', kid.id)
    refresh()
  }

  return (
    <div className="detail">
      <button className="link" onClick={onBack}>
        ← Back to accounts
      </button>
      <h2>{kid.name}</h2>
      <div className="big-balance">${Number(balance).toFixed(2)}</div>

      {/* Interest rate */}
      {editingRate ? (
        <form onSubmit={saveInterestRate} className="rate-edit-form">
          <input
            type="number"
            step="0.1"
            min="0"
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
            style={{ width: '80px' }}
          />
          <span>% annual interest</span>
          <button type="submit" className="inline-btn">Save</button>
          <button type="button" className="inline-btn secondary" onClick={() => { setEditingRate(false); setNewRate(String(currentRate)) }}>
            Cancel
          </button>
        </form>
      ) : (
        <p className="muted">
          {currentRate}% annual interest{' '}
          <button className="edit-inline-btn" onClick={() => setEditingRate(true)}>Edit</button>
        </p>
      )}

      {/* View code */}
      {editingCode ? (
        <form onSubmit={saveCode} className="rate-edit-form">
          <span>View code:</span>
          <input
            value={newCode}
            onChange={(e) => setNewCode(normalizeCode(e.target.value))}
            style={{ width: '120px' }}
            autoCapitalize="characters"
            placeholder="e.g. EMMA"
          />
          <button type="submit" className="inline-btn">Save</button>
          <button type="button" className="inline-btn secondary" onClick={() => { setEditingCode(false); setNewCode(currentCode); setCodeError('') }}>
            Cancel
          </button>
          {codeError && <span className="error">{codeError}</span>}
        </form>
      ) : (
        <p className="muted">
          View code: <strong style={{ color: '#444', letterSpacing: '1px' }}>{currentCode}</strong>{' '}
          <button className="edit-inline-btn" onClick={() => setEditingCode(true)}>Edit</button>
        </p>
      )}

      <div className="row">
        <button onClick={applyMonthlyInterest}>Apply monthly interest</button>
      </div>

      <TransactionForm onSubmit={addTransaction} />

      <h3>History</h3>
      {loading ? (
        <p>Loading…</p>
      ) : transactions.length === 0 ? (
        <p className="muted">No transactions yet.</p>
      ) : (
        <ul className="tx-list">
          {transactions.map((tx) =>
            editingTxId === tx.id ? (
              <li key={tx.id} className="tx-row tx-edit-row">
                <form onSubmit={(e) => saveEditTx(e, tx)} className="tx-inline-form">
                  <div className="row" style={{ gap: '12px', flexWrap: 'wrap' }}>
                    <label className="radio">
                      <input type="radio" checked={editTxKind === 'deposit'} onChange={() => setEditTxKind('deposit')} />
                      Deposit
                    </label>
                    <label className="radio">
                      <input type="radio" checked={editTxKind === 'withdrawal'} onChange={() => setEditTxKind('withdrawal')} />
                      Withdrawal
                    </label>
                  </div>
                  <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editTxAmount}
                      onChange={(e) => setEditTxAmount(e.target.value)}
                      required
                      style={{ width: '100px' }}
                      placeholder="Amount"
                    />
                    <input
                      value={editTxNote}
                      onChange={(e) => setEditTxNote(e.target.value)}
                      placeholder="Note (optional)"
                      style={{ flex: 1, minWidth: '120px' }}
                    />
                    <button type="submit" className="inline-btn">Save</button>
                    <button type="button" className="inline-btn secondary" onClick={() => setEditingTxId(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </li>
            ) : (
              <li key={tx.id} className="tx-row">
                <span className={Number(tx.amount) >= 0 ? 'amount pos' : 'amount neg'}>
                  {Number(tx.amount) >= 0 ? '+' : ''}
                  {Number(tx.amount).toFixed(2)}
                </span>
                <span className="tx-note">{tx.note || (tx.type === 'interest' ? 'Interest' : '')}</span>
                <span className="tx-date">{new Date(tx.created_at).toLocaleDateString()}</span>
                <span className="tx-actions">
                  <button className="edit-inline-btn" onClick={() => startEditTx(tx)}>Edit</button>
                  <button className="edit-inline-btn danger" onClick={() => deleteTx(tx)}>Delete</button>
                </span>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function KidView({ onBack }) {
  const [code, setCode] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data: result, error } = await supabase.rpc('get_kid_view', {
      code: code.trim().toUpperCase(),
    })
    setLoading(false)
    if (error) {
      setError('Something went wrong. Try again.')
      return
    }
    if (!result) {
      setError('That code was not found. Check with a parent.')
      return
    }
    setData(result)
  }

  if (data) {
    return (
      <div className="detail">
        <button className="link" onClick={onBack}>
          ← Back
        </button>
        <h2>{data.name}'s account</h2>
        <div className="big-balance">${Number(data.balance).toFixed(2)}</div>
        <p className="muted">{data.interest_rate}% annual interest · view only</p>
        <h3>History</h3>
        {data.transactions.length === 0 ? (
          <p className="muted">No transactions yet.</p>
        ) : (
          <ul className="tx-list">
            {data.transactions.map((tx, i) => (
              <li key={i} className="tx-row">
                <span className={tx.amount >= 0 ? 'amount pos' : 'amount neg'}>
                  {tx.amount >= 0 ? '+' : ''}
                  {Number(tx.amount).toFixed(2)}
                </span>
                <span className="tx-note">{tx.note || (tx.type === 'interest' ? 'Interest' : '')}</span>
                <span className="tx-date">{new Date(tx.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="card auth-card">
      <button className="link" onClick={onBack}>
        ← Back
      </button>
      <h2>View my account</h2>
      <form onSubmit={handleSubmit} className="form">
        <label>
          Access code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. EMMA"
            required
            autoCapitalize="characters"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Checking…' : 'View account'}
        </button>
      </form>
    </div>
  )
}

function TransactionForm({ onSubmit }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [kind, setKind] = useState('deposit')

  async function handleSubmit(e) {
    e.preventDefault()
    const num = Math.abs(Number(amount))
    if (!num) return
    await onSubmit(kind === 'deposit' ? num : -num, note)
    setAmount('')
    setNote('')
  }

  return (
    <form onSubmit={handleSubmit} className="card form tx-form">
      <div className="row">
        <label className="radio">
          <input type="radio" checked={kind === 'deposit'} onChange={() => setKind('deposit')} />
          Deposit
        </label>
        <label className="radio">
          <input type="radio" checked={kind === 'withdrawal'} onChange={() => setKind('withdrawal')} />
          Withdrawal
        </label>
      </div>
      <label>
        Amount ($)
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </label>
      <label>
        Note (optional)
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. allowance, ice cream" />
      </label>
      <button type="submit">Add transaction</button>
    </form>
  )
}
