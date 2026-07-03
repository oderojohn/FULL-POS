import React, { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { FaBuilding, FaLock, FaUser } from 'react-icons/fa'
import { useAuth } from '../auth/AuthContext'
import { DotLoader } from '../components/LoadingKit'
import nexasIcon from '../assets/nexas-icon.png'

const Login = () => {
  const { session, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({
    companyCode: localStorage.getItem('nexa-pos-company-code') || '',
    username: '',
    password: '',
    pin: '',
  })
  const [mode, setMode] = useState('password')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const defaultRedirect = (sess) => {
    const perms = sess?.permissions || []
    return (perms.includes('*') || perms.includes('dashboard.view')) ? '/dashboard' : '/pos'
  }

  if (session) return <Navigate to={location.state?.from?.pathname || defaultRedirect(session)} replace />

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (form.companyCode.trim().length !== 3) { setError('Please enter your 3-letter company code.'); return }
    setLoading(true)
    try {
      const companyCode = form.companyCode.trim().toUpperCase()
      const base = { company_code: companyCode }
      const nextSession = await login(mode === 'pin'
        ? { ...base, username: form.username, pin: form.pin }
        : { ...base, username: form.username, password: form.password }
      )
      localStorage.setItem('nexa-pos-company-code', companyCode)
      navigate(location.state?.from?.pathname || defaultRedirect(nextSession), { replace: true })
    } catch (err) {
      setError(err.data?.detail || 'Login failed. Check the company code, username, password, or PIN.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 text-slate-900">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-slate-950 p-1.5">
            <img src={nexasIcon} alt="" className="h-full w-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-black">Nexas POS Login</h1>
            <p className="text-sm text-slate-500">Username with password or cashier PIN</p>
          </div>
        </div>

        <label className="mb-4 block">
          <span className="text-xs font-bold uppercase text-slate-500">Company Code</span>
          <div className="relative mt-1">
            <FaBuilding className="absolute left-3 top-3 text-slate-400" />
            <input
              value={form.companyCode}
              onChange={(event) => setForm({ ...form, companyCode: event.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase() })}
              maxLength={3}
              className="h-11 w-full rounded border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 uppercase tracking-widest"
              placeholder="e.g. EMB"
            />
          </div>
        </label>

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

        <button disabled={loading} className="mt-5 h-11 w-full rounded bg-emerald-600 text-sm font-black uppercase text-white disabled:bg-emerald-300 flex items-center justify-center gap-2">
          {loading ? <DotLoader color="white" /> : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

export default Login
