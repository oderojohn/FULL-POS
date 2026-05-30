# Django Admin Guide: Managing Users, Companies, and Branches

## Access Django Admin

1. Go to: `http://localhost:8000/admin/`
2. Login with your superuser credentials

## Managing Companies

### View All Companies
1. Click **"Companies"** in the left menu
2. See all companies with their currency, VAT rate, and status

### Create New Company
1. Click **"Add Company"** button
2. Fill in:
   - **Name**: Company name (e.g., "Northern Region HQ")
   - **Currency**: Select currency (KES, USD, etc.)
   - **VAT Rate**: Enter VAT percentage (e.g., 16)
   - **Status**: Check "is_active" to enable
3. Click **"Save"**

### Edit Company
1. Click company name in the list
2. Modify fields
3. Click **"Save"**

### Delete Company
1. Click company name in the list
2. Scroll to bottom
3. Click **"Delete"**

---

## Managing Branches

### View All Branches
1. Click **"Branches"** in the left menu
2. See all branches with their company, code, location, and status
3. Filter by company or status using the right sidebar

### Create New Branch
1. Click **"Add Branch"** button
2. Fill in:
   - **Company**: Select which company this branch belongs to
   - **Name**: Branch name (e.g., "Nairobi Central")
   - **Code**: Unique code (e.g., "NAIROBI-01")
   - **Location**: Physical location
   - **Status**: Check "is_active" to enable
3. Click **"Save"**

### Edit Branch
1. Click branch name in the list
2. Modify fields
3. Click **"Save"**

### Delete Branch
1. Click branch name in the list
2. Click **"Delete"** at bottom
3. Note: Cannot delete if it has active registers or users

---

## Managing User Profiles (Most Important!)

This is where you allocate users to companies and branches with specific access levels.

### View All Users
1. Click **"User Profiles"** in the left menu
2. You'll see a table with:
   - **User**: Full name or username
   - **Role**: Their job role (Cashier, Manager, Inventory, Admin)
   - **Access Level**: Their permission level
   - **Company**: Which company they belong to
   - **Branch**: Which branch they work at
   - **Status**: Active/Inactive

### Filter Users
Use the right sidebar to filter by:
- **Role**: Cashier, Manager, Inventory, Admin
- **Access Level**: super_admin, company_admin, branch_admin, branch_staff
- **Status**: Active/Inactive
- **Company**: Which company
- **Branch**: Which branch

### Search Users
Type in the search box at the top to find by:
- Username
- First name
- Last name

### Create New User Profile

**Method 1: From User Profiles (Recommended)**
1. Click **"Add User Profile"** button
2. Fill in all fields:

   **User Info Section:**
   - **User**: Select existing Django user (or create one first in Django's Users section)

   **Position & Access Section:**
   - **Role**: Select from Cashier, Manager, Inventory, Admin
   - **Access Level**: Select the appropriate level:
     - `super_admin` → Can access all companies and branches
     - `company_admin` → Can manage all branches in a company
     - `branch_admin` → Can manage only their assigned branch
     - `branch_staff` → Limited access to their assigned branch
   - **PIN**: Optional 4-digit PIN for PIN-based login

   **Scope Section:**
   - **Company**: Select which company this user belongs to
   - **Branch**: Select which branch this user works at

   **Status Section:**
   - **is_active**: Check to enable the user

3. Click **"Save"**

### Edit User Profile
1. Click on the user's name in the list
2. Modify any fields:
   - Change access level
   - Change company assignment
   - Change branch assignment
   - Change role
   - Toggle is_active
3. Click **"Save"**

### Common User Setup Scenarios

#### Scenario 1: Create Super Admin
```
User: [Select admin user]
Role: admin
Access Level: super_admin
Company: [Any - they can see all]
Branch: [Any - they can see all]
```

#### Scenario 2: Create Company Admin (for a specific company)
```
User: [Select manager user]
Role: admin
Access Level: company_admin
Company: Northern Region HQ
Branch: Any branch in that company
```

#### Scenario 3: Create Branch Admin
```
User: [Select branch manager user]
Role: admin
Access Level: branch_admin
Company: Northern Region HQ
Branch: Nairobi Central
```

#### Scenario 4: Create Cashier (Branch Staff)
```
User: [Select cashier user]
Role: cashier
Access Level: branch_staff
Company: Northern Region HQ
Branch: Nairobi Central
```

#### Scenario 5: Create Manager (Branch Staff)
```
User: [Select manager user]
Role: manager
Access Level: branch_staff
Company: Northern Region HQ
Branch: Nairobi Central
```

### Delete User Profile
1. Click on the user's name
2. Scroll to bottom
3. Click **"Delete"**

---

## Step-by-Step: Complete User Setup

### Step 1: Create Company (if needed)
1. Go to Companies
2. Click "Add Company"
3. Enter company details
4. Save

### Step 2: Create Branches for Company
1. Go to Branches
2. Click "Add Branch" for each location
3. Select the company
4. Enter branch details
5. Save each

### Step 3: Create Users in Django Admin
1. Go to Users (top-right, or /admin/auth/user/)
2. Click "Add user"
3. Enter username and password
4. Save

### Step 4: Create User Profiles
1. Go to User Profiles
2. Click "Add User Profile"
3. Select the user from Step 3
4. Select their role (cashier, manager, etc.)
5. Select their access_level (branch_staff, branch_admin, company_admin, super_admin)
6. Select company
7. Select branch
8. Add PIN (optional)
9. Check is_active
10. Save

### Step 5: Test Login
1. Go to frontend login page
2. Login with username and password (or PIN)
3. Verify correct company/branch is showing
4. Verify correct permissions are applied

---

## Common Admin Tasks

### Bulk Update Users to New Access Level
1. Click on User Profiles
2. Check the checkboxes of users to update
3. In "Action" dropdown at bottom, select the action
4. Click "Go"

(Note: For bulk changes not in the dropdown, use Django shell)

### Deactivate User Without Deleting
1. Click on user name
2. Uncheck "is_active"
3. Click "Save"
4. User can no longer login

### Move User to Different Branch
1. Click on user name
2. Change "Company" and "Branch" fields
3. Click "Save"
4. User must logout and login to see new branch

### Change User Role
1. Click on user name
2. Change "Role" field (cashier → manager, etc.)
3. Click "Save"

### Upgrade Access Level
```
Before: branch_staff
After:  branch_admin  → Can manage branch

Before: company_admin
After:  super_admin   → Can manage all companies
```

---

## Tips & Tricks

### Quick Search
Use the search box to find users by:
- Name: "John"
- Username: "john_cashier"
- Branch: "Nairobi"

### Filter by Multiple Criteria
1. Click "Company: Northern Region HQ"
2. Then click "Access Level: branch_staff"
3. Result: All branch staff in that company

### Export Data
1. Select users in list
2. Use browser's "Print" or third-party export tools

### Undo Changes
1. Django doesn't auto-undo
2. Consider Django admin history or backups

---

## Important Fields Explained

| Field | Options | Example |
|-------|---------|---------|
| **Role** | cashier, manager, inventory, admin | cashier |
| **Access Level** | super_admin, company_admin, branch_admin, branch_staff | branch_staff |
| **Company** | Any active company | Northern Region HQ |
| **Branch** | Any branch (preferably in same company) | Nairobi Central |
| **PIN** | 4-6 digit optional code | 1234 |
| **is_active** | Checked = Active, Unchecked = Disabled | ✓ Checked |

---

## Troubleshooting

### Issue: Company dropdown is empty
**Solution**: 
1. Go to Companies first
2. Create at least one company
3. Return to User Profiles

### Issue: Branch dropdown is empty
**Solution**:
1. Select a company first
2. Then branch dropdown will show branches for that company
3. Or create branches in the Branches section first

### Issue: Cannot see new changes in frontend
**Solution**:
1. User must logout and login again
2. Or refresh page (Ctrl+Shift+R for hard refresh)
3. Backend session may need refresh

### Issue: User cannot login
**Check**:
1. Is user in Django Users? (Go to Users section)
2. Is UserProfile created? (Go to User Profiles)
3. Is UserProfile is_active = True?
4. Is password/PIN correct?

---

## Next Steps

1. ✅ Create your companies
2. ✅ Create branches for each company
3. ✅ Create Django users (Users section)
4. ✅ Create UserProfiles with appropriate access levels
5. ✅ Test login with each user type
6. ✅ Verify permissions work as expected

---

## Admin URL Shortcuts

```
Companies:    http://localhost:8000/admin/pos/company/
Branches:     http://localhost:8000/admin/pos/branch/
User Profiles: http://localhost:8000/admin/pos/userprofile/
Users:        http://localhost:8000/admin/auth/user/
```

---

Still need help? Check the documentation files:
- `docs/ROLE_BASED_ACCESS_CONTROL.md` - Technical details
- `docs/USER_SETUP_GUIDE.md` - Python/Django shell commands
