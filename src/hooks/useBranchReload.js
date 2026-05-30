import { useEffect, useCallback } from 'react'

/**
 * Hook to listen for branch reload signals
 * Useful for components that need to refresh branch-scoped data when branch is switched
 * 
 * Usage:
 * useBranchReload(() => {
 *   // Refresh your branch-scoped data here
 *   fetchProducts()
 * })
 */
export const useBranchReload = (callback) => {
  const handleBranchReload = useCallback(() => {
    if (callback) callback()
  }, [callback])

  useEffect(() => {
    window.addEventListener('branchReload', handleBranchReload)
    return () => window.removeEventListener('branchReload', handleBranchReload)
  }, [handleBranchReload])
}

/**
 * Hook to listen for company/branch change events (from local storage changes)
 * Useful for backward compatibility with existing code
 */
export const useCompanyBranchChange = (callback) => {
  const handleChange = useCallback((event) => {
    if (callback) callback(event.detail)
  }, [callback])

  useEffect(() => {
    window.addEventListener('companyBranchChange', handleChange)
    return () => window.removeEventListener('companyBranchChange', handleChange)
  }, [handleChange])
}
