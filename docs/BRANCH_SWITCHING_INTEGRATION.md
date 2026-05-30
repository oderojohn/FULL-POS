# Branch/Company Switching Integration Guide

## Overview
The frontend now has full integration for branch and company switching. Users with admin privileges can switch between branches and companies, and the backend will handle updating their context and returning branch-scoped data.

## Components Updated

### 1. **AuthContext.jsx** - Enhanced Authentication Context
- Added `branch`, `company`, and `company_branches` state tracking
- Added `switchBranch(branchId)` method for switching branches via API
- Added `reloadSignal` to notify other components when branch is switched
- Stores branch/company context in localStorage alongside session data

**New exports:**
```javascript
const {
  switchBranch,      // Function to switch branches
  branch,            // Current branch object
  company,           // Current company object  
  company_branches,  // Array of all branches in current company
  reloadSignal,      // Signal that increments when branch changes
} = useAuth()
```

### 2. **posApi.js** - API Integration
- Added `switchBranch(payload)` method to call backend `/auth/switch-branch/` endpoint
- Accepts object with `branch` ID: `{ branch: branchId }`

### 3. **Layout.jsx** - Header UI
- Updated branch selector in header to use `switchBranch` from AuthContext
- Added loading state (`isSwitchingBranch`) while switching
- Added error display for failed switches
- Dispatches `branchReload` event to notify other components

## How It Works

### User Switches Branch
1. User selects a branch from the dropdown in the header
2. `handleBranchChange()` is triggered
3. AuthContext's `switchBranch()` method is called with branch ID
4. Backend validates the branch switch and returns updated context
5. AuthContext updates state and localStorage
6. `reloadSignal` increments, triggering refresh of branch-scoped data
7. `branchReload` event is dispatched to all listeners

### Components Reload on Branch Switch
When a branch is switched, components can listen for the reload signal using the `useBranchReload` hook:

```javascript
import { useBranchReload } from '../hooks/useBranchReload'

function MyComponent() {
  useBranchReload(() => {
    // This callback runs whenever branch is switched
    // Refresh your branch-scoped data here
    fetchProducts()
    fetchInventory()
    fetchCustomers()
  })
}
```

Or use the legacy `companyBranchChange` event:
```javascript
import { useCompanyBranchChange } from '../hooks/useBranchReload'

function MyComponent() {
  useCompanyBranchChange(({ companyId, branchId }) => {
    console.log(`Switched to branch ${branchId} in company ${companyId}`)
    refreshData()
  })
}
```

## API Endpoints

### Switch Branch
```
POST /api/pos/auth/switch-branch/
Authorization: Required

Request body:
{
  "branch": <branch_id>
}

Response:
{
  "profile": { ... },           // Updated user profile
  "company": { ... },           // Current company object
  "branch": { ... },            // Current branch object
  "company_branches": [...],    // All branches in company
  "reload": true                // Signal to reload data
}
```

## Access Control

- Only users with admin permissions can switch branches
- Regular admins can only switch to branches within their current company
- Superusers can switch to any active branch
- The backend validates all switch requests

## Best Practices

1. **Wrap API calls in useBranchReload:**
   ```javascript
   const [products, setProducts] = useState([])
   
   const loadProducts = async () => {
     const data = await posApi.products({ branch: selectedBranch.id })
     setProducts(data)
   }
   
   useBranchReload(loadProducts)
   ```

2. **Filter API calls by branch:**
   Always pass the current branch ID when fetching branch-scoped data:
   ```javascript
   posApi.products({ branch: selectedBranch.id })
   posApi.sales({ branch: selectedBranch.id })
   posApi.stock({ branch: selectedBranch.id })
   ```

3. **Handle loading states:**
   Show loading indicators while branch is being switched to prevent user confusion

4. **Cache invalidation:**
   When `branchReload` is triggered, clear any cached data and fetch fresh from the server

## localStorage Keys

The following keys are used to persist branch/company selections:

- `nexa-pos-session` - Full session data including branch context
- `selectedCompany` - Currently selected company
- `selectedBranch` - Currently selected branch  
- `currentCompany` - Company ID (legacy)
- `currentBranch` - Branch ID (legacy)

## Error Handling

If a branch switch fails:
1. Error message is displayed in the header below the branch selector
2. `isSwitchingBranch` loading state is cleared
3. Selected branch reverts to previous value
4. Error details are logged to console

Common error messages:
- "Only administrators can switch branch" - User lacks permissions
- "Branch not found, inactive, or outside your company" - Invalid branch
- Network errors or server errors

## Migration Guide

If you have existing code using localStorage directly:

**Old way:**
```javascript
localStorage.setItem('currentBranch', branchId)
window.dispatchEvent(new CustomEvent('companyBranchChange', { detail: { branchId } }))
```

**New way:**
```javascript
const { switchBranch } = useAuth()
await switchBranch(branchId)
```

The new way provides better state management, error handling, and backend validation.
