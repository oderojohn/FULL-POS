# Role-Based Access Control Integration - Implementation Summary

## ✅ Implementation Completed

I've successfully integrated role-based access control (RBAC) with branch/company switching capabilities into your POS system. Here's what was implemented:

## Backend Changes

### 1. **Database Model Updates** (`backend/pos/models.py`)
- Added `access_level` field to `UserProfile` with 4 levels:
  - `super_admin`: Global access to all companies and branches
  - `company_admin`: Access to all branches within assigned company
  - `branch_admin`: Access to only assigned branch
  - `branch_staff`: Limited staff access to assigned branch
- Added `company` ForeignKey field to `UserProfile` for direct company assignment
- Updated `__str__` method to display access level

### 2. **Database Migration** (`backend/pos/migrations/0007_user_access_levels.py`)
- Creates the migration to add new fields to `UserProfile` table
- **To apply**: Run `python manage.py migrate` in the backend directory

### 3. **API Changes** (`backend/pos/views.py`)

#### New Helper Functions
- `is_super_admin(user)` - Check if user is super admin
- `is_company_admin(user)` - Check if user is company admin or above
- `is_branch_admin(user)` - Check if user is branch admin or above

#### Updated Context Builder
- `_build_context_payload()` now respects access levels when determining branch visibility
- Super admins see all branches
- Company admins see branches in their company only
- Branch staff see only their assigned branch

#### Enhanced Login
- `_ensure_dev_cashier()` now sets dev user as `SUPER_ADMIN` with company and branch
- Login response includes `access_level` field

#### New Endpoints
1. **Switch Branch** (Enhanced)
   - `POST /api/pos/auth/switch-branch/`
   - Only company admins and super admins can switch
   - Response includes reload signal and updated context

2. **Switch Company** (New)
   - `POST /api/pos/auth/switch-company/`
   - Only super admins can use this
   - Automatically switches to first active branch in new company

### 4. **Serializer Updates** (`backend/pos/serializers.py`)
- `UserProfileSerializer` now includes `access_level` and `company` fields

## Frontend Changes

### 1. **Enhanced AuthContext** (`src/auth/AuthContext.jsx`)
- Added `ACCESS_LEVELS` constant with all role types
- New helper properties in `useAuth()`:
  - `access_level` - Current user's access level
  - `isSuperAdmin` - Boolean check
  - `isCompanyAdmin` - Boolean check
  - `isBranchAdmin` - Boolean check
  - `canSwitchBranch` - Boolean check
  - `canSwitchCompany` - Boolean check

- New methods:
  - `switchCompany(companyId)` - Switch to different company (super admin only)
  - Enhanced `switchBranch()` to handle access level restrictions

### 2. **Updated API Integration** (`src/api/posApi.js`)
- Added `switchCompany()` method to posApi

### 3. **Revamped CompanyBranchSwitcher** (`src/components/CompanyBranchSwitcher.jsx`)
- Dynamically shows controls based on access level:
  - **Super Admin**: Company dropdown + Branch dropdown
  - **Company Admin**: Company display + Branch dropdown
  - **Branch Staff**: Both static displays
- Integrated with new AuthContext methods
- Better error handling and loading states
- Displays user's current role

## How to Use

### For Backend Setup

1. **Apply Migration**:
   ```bash
   cd backend
   python manage.py migrate
   ```

2. **Create Users with Different Roles**:
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
       role='admin',
       access_level='super_admin',
       company=company,
       branch=branch
   )
   
   # Create Company Admin
   user = User.objects.create_user('companyadmin', password='pass123')
   UserProfile.objects.create(
       user=user,
       role='admin',
       access_level='company_admin',
       company=company,
       branch=branch
   )
   ```

### For Frontend Usage

**Check User Access Level**:
```javascript
import { useAuth } from '../auth/AuthContext'

function MyComponent() {
  const auth = useAuth()
  
  if (auth.isSuperAdmin) {
    // Show super admin features
  } else if (auth.isCompanyAdmin) {
    // Show company admin features
  } else if (auth.isBranchAdmin) {
    // Show branch admin features
  } else {
    // Show branch staff features
  }
}
```

**Switch Branch** (for admins):
```javascript
const auth = useAuth()

if (auth.canSwitchBranch) {
  await auth.switchBranch(2) // Switch to branch with id=2
}
```

**Switch Company** (for super admins):
```javascript
const auth = useAuth()

if (auth.canSwitchCompany) {
  await auth.switchCompany(3) // Switch to company with id=3
}
```

## Permissions & Access Rules

### Company Visibility
- **Super Admin**: Can see all companies
- **Others**: Can only see/access their assigned company

### Branch Visibility  
- **Super Admin**: Can see all branches
- **Company Admin**: Can see branches in their company
- **Branch Staff**: Can only see their branch

### Data Scoping
All API endpoints respect these access rules automatically:
- Companies ViewSet
- Branches ViewSet
- UserProfiles ViewSet
- All other branch-scoped endpoints

## Security Features

✅ **Cross-Company Protection**: Company Admins cannot access other companies  
✅ **Branch Isolation**: Branch Staff cannot switch branches  
✅ **Audit Logging**: All switches are logged to AuditLog  
✅ **Access Level Validation**: Every endpoint validates permissions  

## Files Modified/Created

### Backend
- ✅ `backend/pos/models.py` - Updated UserProfile
- ✅ `backend/pos/views.py` - Enhanced auth logic
- ✅ `backend/pos/serializers.py` - Updated serializers
- ✅ `backend/pos/migrations/0007_user_access_levels.py` - New migration

### Frontend
- ✅ `src/auth/AuthContext.jsx` - Enhanced with access levels
- ✅ `src/api/posApi.js` - Added switchCompany method
- ✅ `src/components/CompanyBranchSwitcher.jsx` - Rebuilt with RBAC support

### Documentation
- ✅ `docs/ROLE_BASED_ACCESS_CONTROL.md` - Comprehensive documentation

## Next Steps

1. **Apply the migration**:
   ```bash
   cd backend
   python manage.py migrate
   ```

2. **Test with the dev cashier user**:
   - The dev cashier is now automatically created as SUPER_ADMIN
   - Username: `cashier`
   - Password: `cashier123`
   - PIN: `1234`

3. **Create additional test users** with different access levels

4. **Test branch/company switching** in the UI

5. **Deploy to production** once verified

## Troubleshooting

**Issue**: User cannot switch branches
- ✓ Check user has `access_level` = `company_admin` or `super_admin`
- ✓ Check user's company assignment matches
- ✓ Check branches are `is_active=True`

**Issue**: Company dropdown not showing
- ✓ Verify user `access_level` = `super_admin`
- ✓ Check API `/api/pos/companies/` returns data
- ✓ Check browser console for errors

**Issue**: Migration fails
- ✓ Check database connection
- ✓ Ensure no conflicts with existing fields
- ✓ Run `python manage.py makemigrations pos` to verify

## Additional Notes

- The system maintains backward compatibility with existing user roles (Cashier, Manager, Inventory, Admin)
- Access levels are independent of the traditional role system
- Users can have both a traditional role AND an access level
- The reload signal tells the frontend to refresh all branch-scoped data
- All company/branch switches are audit-logged for security
