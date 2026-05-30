import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { posApi } from '../api/posApi'
import { ACCESS_LEVELS, createAccessController } from './rbac'

const STORAGE_KEY = 'nexa-pos-session'
const LAST_REFRESH_KEY = 'nexa-pos-session-last-refresh'
const SESSION_REFRESH_MIN_AGE_MS = 5 * 60 * 1000
const AuthContext = createContext(null)
export { ACCESS_LEVELS }

const readSession = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null
  } catch {
    return null
  }
}

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key)

const mergeSession = (current, nextSession, { authoritativeAccess = false } = {}) => {
  const merged = { ...current, ...nextSession, token: current?.token || nextSession?.token }

  if (authoritativeAccess) {
    if (!hasOwn(nextSession, 'permissions')) delete merged.permissions
    if (!hasOwn(nextSession, 'admin_sections')) delete merged.admin_sections
  }

  return merged
}

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(readSession)
  const [reloadSignal, setReloadSignal] = useState(0)
  const refreshInFlightRef = useRef(null)
  const lastRefreshAtRef = useRef(0)

  const login = async (credentials) => {
    const nextSession = await posApi.login(credentials)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession))
    setSession(nextSession)
    return nextSession
  }

  const switchBranch = useCallback(async (branchId) => {
    if (!session) throw new Error('Not authenticated')
    try {
      const response = await posApi.switchBranch({ branch: branchId })
      
      // Update session with new context data
      const updatedSession = {
        ...session,
        profile: response.profile,
        company: response.company,
        branch: response.branch,
        company_branches: response.company_branches,
        access_level: response.access_level,
        permissions: response.permissions ?? session.permissions,
        admin_sections: response.admin_sections ?? session.admin_sections,
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSession))
      setSession(updatedSession)
      
      // Trigger reload signal if backend indicates to do so
      if (response.reload) {
        setReloadSignal(prev => prev + 1)
      }
      
      return { success: true, reload: response.reload, session: updatedSession }
    } catch (error) {
      console.error('Branch switch failed:', error)
      throw error
    }
  }, [session])

  const switchCompany = useCallback(async (companyId) => {
    if (!session) throw new Error('Not authenticated')
    try {
      const response = await posApi.switchCompany({ company: companyId })
      
      // Update session with new context data
      const updatedSession = {
        ...session,
        profile: response.profile,
        company: response.company,
        branch: response.branch,
        company_branches: response.company_branches,
        access_level: response.access_level,
        permissions: response.permissions ?? session.permissions,
        admin_sections: response.admin_sections ?? session.admin_sections,
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSession))
      setSession(updatedSession)
      
      // Trigger reload signal if backend indicates to do so
      if (response.reload) {
        setReloadSignal(prev => prev + 1)
      }
      
      return { success: true, reload: response.reload, session: updatedSession }
    } catch (error) {
      console.error('Company switch failed:', error)
      throw error
    }
  }, [session])

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LAST_REFRESH_KEY)
    localStorage.removeItem('selectedCompany')
    localStorage.removeItem('selectedBranch')
    localStorage.removeItem('currentCompany')
    localStorage.removeItem('currentBranch')
    setSession(null)
  }

  const refreshSession = useCallback(async ({ force = false } = {}) => {
    const current = readSession()
    if (!current?.token) return null
    const now = Date.now()
    const lastStoredRefresh = Number(localStorage.getItem(LAST_REFRESH_KEY) || 0)
    const lastRefreshAt = Math.max(lastRefreshAtRef.current, Number.isFinite(lastStoredRefresh) ? lastStoredRefresh : 0)
    if (!force && now - lastRefreshAt < SESSION_REFRESH_MIN_AGE_MS) return current
    if (refreshInFlightRef.current) return refreshInFlightRef.current

    refreshInFlightRef.current = posApi.me()
      .then((nextSession) => {
        const merged = mergeSession(current, nextSession, { authoritativeAccess: true })
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
        lastRefreshAtRef.current = Date.now()
        localStorage.setItem(LAST_REFRESH_KEY, String(lastRefreshAtRef.current))
        setSession(merged)
        return merged
      })
      .finally(() => {
        refreshInFlightRef.current = null
      })

    return refreshInFlightRef.current
  }, [])

  useEffect(() => {
    const handleExpired = () => logout()
    const handleRightsUpdated = () => setSession(readSession())
    window.addEventListener('pos-auth-expired', handleExpired)
    window.addEventListener('pos-rights-updated', handleRightsUpdated)
    return () => {
      window.removeEventListener('pos-auth-expired', handleExpired)
      window.removeEventListener('pos-rights-updated', handleRightsUpdated)
    }
  }, [])

  useEffect(() => {
    if (!session?.token) return undefined
    let cancelled = false
    const verify = async () => {
      try {
        if (cancelled) return
        await refreshSession()
      } catch {
        // requestFrom dispatches pos-auth-expired for inactive/expired sessions.
      }
    }
    const handleFocus = () => verify()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') verify()
    }
    const timer = window.setInterval(verify, SESSION_REFRESH_MIN_AGE_MS)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    verify()
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [refreshSession, session?.token])

  const value = useMemo(() => {
    const access = createAccessController(session)
    
    return {
      session,
      user: session?.user,
      profile: session?.profile,
      permissions: access.permissions,
      can: access.hasPermission,
      canAny: (...codes) => access.hasAnyPermission(codes),
      canAll: (...codes) => access.hasAllPermissions(codes),
      adminSections: session?.admin_sections || {},
      canAccessAdmin: access.canAccessAdmin,
      canAccessPolicy: access.canAccessPolicy,
      canAccessRoute: access.canAccessRoute,
      login,
      logout,
      refreshSession,
      switchBranch,
      switchCompany,
      branch: session?.branch,
      company: session?.company,
      company_branches: session?.company_branches || [],
      access_level: access.accessLevel,
      reloadSignal,
      isSuperAdmin: access.isSuperAdmin,
      isCompanyAdmin: access.isCompanyAdmin,
      isBranchAdmin: access.isBranchAdmin,
      canSwitchBranch: access.canSwitchBranch,
      canSwitchCompany: access.canSwitchCompany,
    }
  }, [session, reloadSignal, refreshSession, switchBranch, switchCompany])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
