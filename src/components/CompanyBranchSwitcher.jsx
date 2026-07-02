import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { posApi } from '../api/posApi'
import { Spinner } from './LoadingKit'

export default function CompanyBranchSwitcher() {
  const auth = useAuth()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(false)
  const [switchingBranch, setSwitchingBranch] = useState(false)
  const [switchingCompany, setSwitchingCompany] = useState(false)
  const [error, setError] = useState(null)

  // Fetch all companies (only for super admin)
  useEffect(() => {
    if (auth.isSuperAdmin) {
      fetchCompanies()
    }
  }, [auth.isSuperAdmin])

  const fetchCompanies = async () => {
    try {
      setLoading(true)
      const data = await posApi.companies()
      setCompanies(Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching companies:', error)
      setError('Failed to load companies')
    } finally {
      setLoading(false)
    }
  }

  const handleBranchChange = async (branchId) => {
    if (!auth.canSwitchBranch) return
    
    try {
      setSwitchingBranch(true)
      setError(null)
      await auth.switchBranch(parseInt(branchId))
    } catch (error) {
      console.error('Failed to switch branch:', error)
      setError('Failed to switch branch')
    } finally {
      setSwitchingBranch(false)
    }
  }

  const handleCompanyChange = async (companyId) => {
    if (!auth.canSwitchCompany) return
    
    try {
      setSwitchingCompany(true)
      setError(null)
      await auth.switchCompany(parseInt(companyId))
    } catch (error) {
      console.error('Failed to switch company:', error)
      setError('Failed to switch company')
    } finally {
      setSwitchingCompany(false)
    }
  }

  const currentBranch = auth.branch
  const currentCompany = auth.company
  const branchOptions = auth.company_branches || []
  const userRole = auth.profile?.access_level

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner size="sm" color="slate" />
        <span>Loading…</span>
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-4">
      {error && (
        <div className="text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Company Dropdown - Only for Super Admin */}
      {auth.isSuperAdmin && (
        <div className="relative">
          <label className="text-xs text-gray-600 font-semibold">Company:</label>
          <select
            value={currentCompany?.id || ''}
            onChange={(e) => handleCompanyChange(e.target.value)}
            disabled={switchingCompany || companies.length === 0}
            className="appearance-none bg-white border border-gray-300 text-gray-700 py-2 px-4 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-indigo-500 text-sm disabled:opacity-50"
          >
            <option value="">Select Company</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 top-6">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
            </svg>
          </div>
        </div>
      )}

      {/* Branch Dropdown - For Company Admin and above */}
      {auth.canSwitchBranch && (
        <div className="relative">
          <label className="text-xs text-gray-600 font-semibold">Branch:</label>
          <select
            value={currentBranch?.id || ''}
            onChange={(e) => handleBranchChange(e.target.value)}
            disabled={switchingBranch || branchOptions.length === 0}
            className="appearance-none bg-white border border-gray-300 text-gray-700 py-2 px-4 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-indigo-500 text-sm disabled:opacity-50"
          >
            <option value="">Select Branch</option>
            {branchOptions.map(branch => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 top-6">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
            </svg>
          </div>
        </div>
      )}

      {/* Display Current Branch for non-admin staff */}
      {!auth.canSwitchBranch && currentBranch && (
        <div className="text-sm font-semibold">
          <div className="text-xs text-gray-600">Branch:</div>
          <div className="text-gray-900">{currentBranch.name}</div>
        </div>
      )}

      {/* Display Current Company for non-super-admin */}
      {!auth.isSuperAdmin && currentCompany && (
        <div className="text-sm font-semibold">
          <div className="text-xs text-gray-600">Company:</div>
          <div className="text-gray-900">{currentCompany.name}</div>
        </div>
      )}

      {/* Display User Role */}
      <div className="text-sm">
        <div className="text-xs text-gray-600">Role:</div>
        <div className="text-gray-900 capitalize">{userRole?.replace('_', ' ')}</div>
      </div>
    </div>
  )
}
