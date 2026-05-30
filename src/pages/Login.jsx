import React, { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { FaCashRegister, FaLock, FaUser } from 'react-icons/fa'
import { useAuth } from '../auth/AuthContext'

const Login = () => {
  const { session, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: 'cashier', password: 'cashier123', pin: '1234' })
  const [mode, setMode] = useState('password')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to={location.state?.from?.pathname || '/dashboard'} replace />

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(mode === 'pin' ? { username: form.username, pin: form.pin } : { username: form.username, password: form.password })
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true })
    } catch (err) {
      setError(err.data?.detail || 'Login failed. Check the username, password, or PIN.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 text-slate-900">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-emerald-600 text-white">
            <FaCashRegister />
          </div>
          <div>
            <h1 className="text-xl font-black">Nexa POS Login</h1>
            <p className="text-sm text-slate-500">Username with password or cashier PIN</p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setMode('password')} className={`h-10 rounded text-sm font-bold ${mode === 'password' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>Password</button>
          <button type="button" onClick={() => setMode('pin')} className={`h-10 rounded text-sm font-bold ${mode === 'pin' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>PIN</button>
        </div>

        <label className="block">
          <span className="text-xs font-bold uppercase text-slate-500">Username</span>
          <div className="relative mt-1">
            <FaUser className="absolute left-3 top-3 text-slate-400" />
            <input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} className="h-11 w-full rounded border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-emerald-500" />
          </div>
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-bold uppercase text-slate-500">{mode === 'pin' ? 'PIN' : 'Password'}</span>
          <div className="relative mt-1">
            <FaLock className="absolute left-3 top-3 text-slate-400" />
            <input
              type={mode === 'pin' ? 'text' : 'password'}
              value={mode === 'pin' ? form.pin : form.password}
              onChange={(event) => setForm({ ...form, [mode === 'pin' ? 'pin' : 'password']: event.target.value })}
              className="h-11 w-full rounded border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>
        </label>

        {error && <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div>}

        <button disabled={loading} className="mt-5 h-11 w-full rounded bg-emerald-600 text-sm font-black uppercase text-white disabled:bg-emerald-300">
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

export default Login
