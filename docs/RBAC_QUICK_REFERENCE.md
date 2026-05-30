# Quick Reference: Role-Based Access Control

## Access Levels Explained

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPER_ADMIN                              │
│  • Access: All companies, all branches                       │
│  • Can: Switch company, switch branch                        │
│  • Scope: Global                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  COMPANY_ADMIN                              │
│  • Access: All branches in assigned company                  │
│  • Can: Switch branch within company                         │
│  • Cannot: Switch company                                    │
│  • Scope: Company-wide                                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   BRANCH_ADMIN                              │
│  • Access: Only assigned branch                              │
│  • Can: Manage branch settings                               │
│  • Cannot: Switch branch or company                          │
│  • Scope: Single branch                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   BRANCH_STAFF                              │
│  • Access: Only assigned branch                              │
│  • Can: Perform daily POS operations                         │
│  • Cannot: Switch branch or company                          │
│  • Scope: Single branch (limited)                            │
└─────────────────────────────────────────────────────────────┘
```

## Frontend Code Examples

### Check User Access Level
```javascript
import { useAuth } from '../auth/AuthContext'

function Dashboard() {
  const auth = useAuth()
  
  return (
    <>
      {auth.isSuperAdmin && <AdminPanel />}
      {auth.isCompanyAdmin && <CompanyPanel />}
      {auth.isBranchAdmin && <BranchManagement />}
      {!auth.isSuperAdmin && <StaffView />}
    </>
  )
}
```

### Switch Branch (Company Admin or Super Admin only)
```javascript
const auth = useAuth()

if (auth.canSwitchBranch) {
  try {
    await auth.switchBranch(2)
    console.log('Switched to branch:', auth.branch.name)
  } catch (error) {
    console.error('Failed to switch:', error)
  }
}
```

### Switch Company (Super Admin only)
```javascript
const auth = useAuth()

if (auth.canSwitchCompany) {
  try {
    await auth.switchCompany(3)
    console.log('Switched to company:', auth.company.name)
  } catch (error) {
    console.error('Failed to switch:', error)
  }
}
```

### Protect Component with Access Level
```javascript
import { useAuth } from '../auth/AuthContext'

function AdminFeature() {
  const auth = useAuth()
  
  if (!auth.isCompanyAdmin) {
    return <div>You don't have permission to access this feature</div>
  }
  
  return <div>Admin Feature Content</div>
}
```

### Get Available Branches
```javascript
const auth = useAuth()

// Get all branches user can access
const branches = auth.company_branches

branches.forEach(branch => {
  console.log(`${branch.name} (ID: ${branch.id})`)
})
```

### Display User Info
```javascript
const auth = useAuth()

console.log('User:', auth.user.username)
console.log('Access Level:', auth.access_level)
console.log('Role:', auth.profile.role)
console.log('Current Branch:', auth.branch.name)
console.log('Current Company:', auth.company.name)
```

## Backend Code Examples

### Check User Access in Views
```python
from pos.views import is_super_admin, is_company_admin, is_branch_admin

def my_view(request):
    if is_super_admin(request.user):
        # Show all data
    elif is_company_admin(request.user):
        # Show company data
    elif is_branch_admin(request.user):
        # Show branch data
    else:
        # Restrict access
```

### Get User's Access Level
```python
from pos.models import UserProfile

profile = request.user.pos_profile
access_level = profile.access_level

if access_level == UserProfile.SUPER_ADMIN:
    # Handle super admin
elif access_level == UserProfile.COMPANY_ADMIN:
    # Handle company admin
elif access_level == UserProfile.BRANCH_ADMIN:
    # Handle branch admin
else:
    # Handle branch staff
```

### Create User with Access Level
```python
from django.contrib.auth import get_user_model
from pos.models import UserProfile, Company, Branch

User = get_user_model()

# Create user
user = User.objects.create_user('newuser', password='pass123')

# Create profile with access level
company = Company.objects.get(id=1)
branch = company.branches.first()

UserProfile.objects.create(
    user=user,
    role='admin',
    access_level='company_admin',  # Set access level
    company=company,
    branch=branch
)
```

### Filter Data by Access Level
```python
from pos.models import UserProfile

def get_visible_users(request):
    user = request.user
    profile = user.pos_profile
    
    queryset = UserProfile.objects.all()
    
    if profile.access_level == UserProfile.SUPER_ADMIN:
        # Return all users
        return queryset
    elif profile.access_level == UserProfile.COMPANY_ADMIN:
        # Return users in same company
        return queryset.filter(company=profile.company)
    else:
        # Return users in same branch
        return queryset.filter(branch=profile.branch)
```

## Database Queries

### Get all super admins
```python
from pos.models import UserProfile

super_admins = UserProfile.objects.filter(
    access_level='super_admin'
).select_related('user')
```

### Get all company admins for a company
```python
company_admins = UserProfile.objects.filter(
    company=company,
    access_level='company_admin'
).select_related('user')
```

### Get all users with branch assignment
```python
branch_users = UserProfile.objects.filter(
    branch__isnull=False
).select_related('user', 'branch', 'company')
```

## Constants

### In Frontend
```javascript
import { ACCESS_LEVELS } from '../auth/AuthContext'

ACCESS_LEVELS.SUPER_ADMIN      // 'super_admin'
ACCESS_LEVELS.COMPANY_ADMIN    // 'company_admin'
ACCESS_LEVELS.BRANCH_ADMIN     // 'branch_admin'
ACCESS_LEVELS.BRANCH_STAFF     // 'branch_staff'
```

### In Backend (Python)
```python
from pos.models import UserProfile

UserProfile.SUPER_ADMIN        # 'super_admin'
UserProfile.COMPANY_ADMIN      # 'company_admin'
UserProfile.BRANCH_ADMIN       # 'branch_admin'
UserProfile.BRANCH_STAFF       # 'branch_staff'

UserProfile.ACCESS_LEVEL_CHOICES  # List of (value, label) tuples
```

## API Endpoints

### Authentication
- `POST /api/pos/auth/login/` - Login (returns access_level)
- `POST /api/pos/auth/switch-branch/` - Switch branch (admin only)
- `POST /api/pos/auth/switch-company/` - Switch company (super admin only)

### User Management
- `GET /api/pos/user-profiles/` - List profiles (filtered by access)
- `POST /api/pos/user-profiles/` - Create profile (admin only)
- `PATCH /api/pos/user-profiles/{id}/` - Update profile (admin only)

## Testing Access Levels

### Dev User (Auto-created)
- Username: `cashier`
- Password: `cashier123`
- PIN: `1234`
- Access Level: `SUPER_ADMIN`

### Test Login
```bash
curl -X POST http://localhost:8000/api/pos/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"cashier","password":"cashier123"}'
```

### Test Branch Switch
```bash
curl -X POST http://localhost:8000/api/pos/auth/switch-branch/ \
  -H "Content-Type: application/json" \
  -d '{"branch":2}'
```

### Test Company Switch
```bash
curl -X POST http://localhost:8000/api/pos/auth/switch-company/ \
  -H "Content-Type: application/json" \
  -d '{"company":3}'
```

## Common Patterns

### Conditionally Render Based on Role
```jsx
{auth.isSuperAdmin && (
  <button onClick={() => handleCompanySwitch()}>
    Switch Company
  </button>
)}

{auth.canSwitchBranch && (
  <BranchSelector 
    branches={auth.company_branches}
    onSwitch={auth.switchBranch}
  />
)}
```

### Protected API Calls
```javascript
async function getAdminData() {
  const auth = useAuth()
  
  if (!auth.isCompanyAdmin) {
    throw new Error('Insufficient permissions')
  }
  
  return posApi.getUserProfiles()
}
```

### Handle Reload Signal
```javascript
useEffect(() => {
  // Triggered when user switches branch/company
  fetchAllBranchData()
}, [auth.reloadSignal])
```
