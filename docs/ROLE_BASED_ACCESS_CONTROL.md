# Role-Based Access Control Implementation

## Overview
This document describes the role-based access control (RBAC) system implemented in the POS system, which allows users to be allocated to different access levels across companies and branches.

## Access Levels

### 1. **Super Admin** (`super_admin`)
- **Scope**: Global (all companies and branches)
- **Permissions**:
  - Can access all companies
  - Can switch between any company
  - Can switch to any branch across all companies
  - Can manage all user roles
  - Can view all data across the system

### 2. **Company Admin** (`company_admin`)
- **Scope**: Specific company (all branches within the company)
- **Permissions**:
  - Can only access their assigned company
  - Can switch between branches within their company
  - Can manage all users within their company
  - Can manage all branches in their company

### 3. **Branch Admin** (`branch_admin`)
- **Scope**: Specific branch
- **Permissions**:
  - Can only access their assigned branch
  - Cannot switch branches
  - Can manage users in their branch
  - Can manage branch-specific settings

### 4. **Branch Staff** (`branch_staff`)
- **Scope**: Specific branch
- **Permissions**:
  - Can only access their assigned branch
  - Cannot switch branches
  - Can perform daily POS operations (sell, hold, shift)
  - Limited permissions based on their role (Cashier, Manager, Inventory)

## Database Schema Changes

### UserProfile Model Updates
Added two new fields to `UserProfile`:
```python
access_level = models.CharField(
    max_length=30,
    choices=[
        ('super_admin', 'Super Admin'),
        ('company_admin', 'Company Admin'),
        ('branch_admin', 'Branch Admin'),
        ('branch_staff', 'Branch Staff'),
    ],
    default='branch_staff'
)

company = models.ForeignKey(
    Company,
    null=True,
    blank=True,
    related_name='staff_profiles',
    on_delete=models.SET_NULL
)
```

### Migration
Run the following to apply the changes:
```bash
python manage.py migrate
```

## Backend API Changes

### Authentication Endpoints

#### Login Response
Returns user profile with access level:
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "full_name": "Admin User",
    "is_superuser": false
  },
  "profile": {
    "id": 1,
    "role": "admin",
    "access_level": "super_admin",
    "branch": {...},
    "company": {...}
  },
  "permissions": ["*"],
  "company": {...},
  "branch": {...},
  "company_branches": [...],
  "access_level": "super_admin"
}
```

#### Switch Branch
**Endpoint**: `POST /api/pos/auth/switch-branch/`

Only Company Admins and Super Admins can switch branches.

**Request**:
```json
{
  "branch": 2
}
```

**Response**:
```json
{
  "profile": {...},
  "reload": true,
  "company": {...},
  "branch": {...},
  "company_branches": [...],
  "access_level": "company_admin"
}
```

#### Switch Company (New)
**Endpoint**: `POST /api/pos/auth/switch-company/`

Only Super Admins can switch companies.

**Request**:
```json
{
  "company": 3
}
```

**Response**:
```json
{
  "profile": {...},
  "reload": true,
  "company": {...},
  "branch": {...},
  "company_branches": [...],
  "access_level": "super_admin"
}
```

### Permission Checking Functions

#### Backend (views.py)
```python
# Check if user is super admin
is_super_admin(user) -> bool

# Check if user is company admin or above
is_company_admin(user) -> bool

# Check if user is branch admin or above
is_branch_admin(user) -> bool
```

## Frontend Implementation

### AuthContext Updates

Enhanced `AuthContext` with new properties and methods:

```javascript
// Access level constants
export const ACCESS_LEVELS = {
  SUPER_ADMIN: 'super_admin',
  COMPANY_ADMIN: 'company_admin',
  BRANCH_ADMIN: 'branch_admin',
  BRANCH_STAFF: 'branch_staff',
}

// In useAuth hook:
{
  access_level: string,           // Current user's access level
  isSuperAdmin: boolean,          // Check if super admin
  isCompanyAdmin: boolean,        // Check if company admin or above
  isBranchAdmin: boolean,         // Check if branch admin or above
  canSwitchBranch: boolean,       // Check if can switch branches
  canSwitchCompany: boolean,      // Check if can switch companies
  switchBranch(branchId): Promise // Switch to branch
  switchCompany(companyId): Promise // Switch to company
}
```

### CompanyBranchSwitcher Component

Updated to show controls based on access level:

**For Super Admin**:
- Company dropdown (can switch)
- Branch dropdown (can switch)
- User role display

**For Company Admin**:
- Company display (static)
- Branch dropdown (can switch)
- User role display

**For Branch Admin/Staff**:
- Company display (static)
- Branch display (static)
- User role display

## Usage Examples

### Checking User Access Level in Frontend

```javascript
import { useAuth } from '../auth/AuthContext'

function MyComponent() {
  const auth = useAuth()

  return (
    <div>
      {auth.isSuperAdmin && (
        <button onClick={() => auth.switchCompany(2)}>
          Switch Company
        </button>
      )}

      {auth.canSwitchBranch && (
        <select onChange={(e) => auth.switchBranch(e.target.value)}>
          {auth.company_branches.map(branch => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
```

### Protecting Routes Based on Access Level

```javascript
import { useAuth } from '../auth/AuthContext'

function AdminRoute({ children }) {
  const auth = useAuth()
  
  if (!auth.isCompanyAdmin) {
    return <div>Access Denied</div>
  }
  
  return children
}
```

### Conditional Rendering Based on Access

```javascript
// Show features only for certain roles
{auth.isSuperAdmin && <SuperAdminFeatures />}
{auth.isCompanyAdmin && <CompanyAdminFeatures />}
{!auth.isSuperAdmin && <BranchSpecificFeatures />}
```

## API Scoping Rules

### Companies ViewSet
- **Super Admin**: Can view all companies
- **Company Admin**: Can only view their assigned company
- **Branch Staff**: Can only view their company (via branch)

### Branches ViewSet
- **Super Admin**: Can view all branches
- **Company Admin**: Can only view branches in their company
- **Branch Staff**: Can only view their assigned branch

### UserProfiles ViewSet
- **Super Admin**: Can view all user profiles
- **Company Admin**: Can view profiles in their company
- **Branch Staff**: Can only view profiles in their branch

## Development/Testing

### Create Dev Users with Different Roles

```python
# In Django shell or management command
from django.contrib.auth import get_user_model
from pos.models import UserProfile, Company, Branch

User = get_user_model()

# Create Super Admin
user = User.objects.create_user('superadmin', password='pass123')
company = Company.objects.first()
branch = Branch.objects.filter(company=company).first()
UserProfile.objects.create(
    user=user,
    access_level='super_admin',
    company=company,
    branch=branch
)

# Create Company Admin
user = User.objects.create_user('companyadmin', password='pass123')
UserProfile.objects.create(
    user=user,
    access_level='company_admin',
    company=company,
    branch=branch
)

# Create Branch Admin
user = User.objects.create_user('branchadmin', password='pass123')
UserProfile.objects.create(
    user=user,
    access_level='branch_admin',
    company=company,
    branch=branch
)
```

### Login Response Signal

When a user logs in or switches branch/company, the frontend receives:
- `reload: true` signal to clear cached data
- Updated `company_branches` list based on access level
- Updated `access_level` in response

Frontend components should handle the reload signal to refresh all branch-scoped data.

## Security Considerations

1. **Access Level Validation**: All API endpoints validate access level before returning data
2. **Cross-Company Protection**: Company Admins cannot access branches from other companies
3. **Branch Isolation**: Branch Staff are strictly isolated to their assigned branch
4. **Audit Logging**: All branch/company switches are logged to AuditLog

## Migration Path

1. Run migration: `python manage.py migrate`
2. Update existing user profiles with appropriate access levels
3. Update frontend to use new AuthContext methods
4. Test branch/company switching for each access level
5. Deploy to production

## Troubleshooting

### Issue: User cannot switch branches
- Check if user has `access_level` set to `company_admin` or `super_admin`
- Verify user's `company` field matches the branch's company
- Check browser console for API errors

### Issue: Company dropdown not showing
- Verify user is super admin (`access_level == 'super_admin'`)
- Check if companies were fetched successfully
- Verify API endpoint `/api/pos/companies/` is accessible

### Issue: Branches not loading
- Verify user's company is set
- Check if branches exist for that company
- Verify `is_active=True` on branches
