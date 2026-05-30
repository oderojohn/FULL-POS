# User Setup Guide: Creating Users with Different Access Levels

## Overview

This guide shows how to create and configure users with different access levels for testing and production use.

## Django Shell Access

```bash
# Enter Django shell
python manage.py shell

# Or use Django shell plus for better interface
pip install django-extensions
python manage.py shell_plus
```

## User Creation Commands

### 1. Create Super Admin User

```python
from django.contrib.auth import get_user_model
from pos.models import UserProfile, Company, Branch

User = get_user_model()

# Create user
superadmin_user = User.objects.create_user(
    username='superadmin',
    email='superadmin@example.com',
    password='superadmin123'
)
superadmin_user.is_staff = True
superadmin_user.is_superuser = True
superadmin_user.save()

# Get first company and branch
company = Company.objects.first()
branch = company.branches.first()

# Create profile with Super Admin access
UserProfile.objects.create(
    user=superadmin_user,
    pin='1111',
    role='admin',
    access_level='super_admin',
    company=company,
    branch=branch,
    is_active=True
)

print(f"✓ Super Admin created: {superadmin_user.username}")
```

### 2. Create Company Admin User

```python
from django.contrib.auth import get_user_model
from pos.models import UserProfile, Company

User = get_user_model()

# Create user
companyadmin_user = User.objects.create_user(
    username='companyadmin',
    email='companyadmin@example.com',
    password='companyadmin123'
)
companyadmin_user.is_staff = True
companyadmin_user.save()

# Get company and one of its branches
company = Company.objects.get(name='Demo Company')  # or use: Company.objects.first()
branch = company.branches.first()

# Create profile with Company Admin access
UserProfile.objects.create(
    user=companyadmin_user,
    pin='2222',
    role='admin',
    access_level='company_admin',
    company=company,
    branch=branch,
    is_active=True
)

print(f"✓ Company Admin created: {companyadmin_user.username}")
```

### 3. Create Branch Admin User

```python
from django.contrib.auth import get_user_model
from pos.models import UserProfile, Branch

User = get_user_model()

# Create user
branchadmin_user = User.objects.create_user(
    username='branchadmin',
    email='branchadmin@example.com',
    password='branchadmin123'
)
branchadmin_user.is_staff = True
branchadmin_user.save()

# Get specific branch
branch = Branch.objects.get(code='MAIN')  # or use: Branch.objects.first()
company = branch.company

# Create profile with Branch Admin access
UserProfile.objects.create(
    user=branchadmin_user,
    pin='3333',
    role='admin',
    access_level='branch_admin',
    company=company,
    branch=branch,
    is_active=True
)

print(f"✓ Branch Admin created: {branchadmin_user.username}")
```

### 4. Create Branch Staff (Cashier)

```python
from django.contrib.auth import get_user_model
from pos.models import UserProfile, Branch

User = get_user_model()

# Create user
cashier_user = User.objects.create_user(
    username='cashier_staff',
    email='cashier@example.com',
    password='cashier123'
)

# Get specific branch
branch = Branch.objects.first()
company = branch.company

# Create profile with Branch Staff access and Cashier role
UserProfile.objects.create(
    user=cashier_user,
    pin='4444',
    role='cashier',  # Specific job role
    access_level='branch_staff',
    company=company,
    branch=branch,
    is_active=True
)

print(f"✓ Cashier Staff created: {cashier_user.username}")
```

### 5. Create Manager Staff

```python
from django.contrib.auth import get_user_model
from pos.models import UserProfile, Branch

User = get_user_model()

# Create user
manager_user = User.objects.create_user(
    username='manager_staff',
    email='manager@example.com',
    password='manager123'
)

# Get specific branch
branch = Branch.objects.first()
company = branch.company

# Create profile with Branch Staff access and Manager role
UserProfile.objects.create(
    user=manager_user,
    pin='5555',
    role='manager',  # Specific job role
    access_level='branch_staff',
    company=company,
    branch=branch,
    is_active=True
)

print(f"✓ Manager Staff created: {manager_user.username}")
```

### 6. Create Inventory Staff

```python
from django.contrib.auth import get_user_model
from pos.models import UserProfile, Branch

User = get_user_model()

# Create user
inventory_user = User.objects.create_user(
    username='inventory_staff',
    email='inventory@example.com',
    password='inventory123'
)

# Get specific branch
branch = Branch.objects.first()
company = branch.company

# Create profile with Branch Staff access and Inventory role
UserProfile.objects.create(
    user=inventory_user,
    pin='6666',
    role='inventory',  # Specific job role
    access_level='branch_staff',
    company=company,
    branch=branch,
    is_active=True
)

print(f"✓ Inventory Staff created: {inventory_user.username}")
```

## Bulk User Creation Script

Save this as `create_test_users.py` in your backend directory:

```python
#!/usr/bin/env python
"""
Management command to create test users with different access levels.
Usage: python manage.py shell < create_test_users.py
"""

from django.contrib.auth import get_user_model
from pos.models import UserProfile, Company, Branch

User = get_user_model()

# Clear existing test users (optional)
# User.objects.filter(username__in=['superadmin', 'companyadmin', 'branchadmin', 'cashier_staff']).delete()

def create_test_users():
    """Create test users with different access levels."""
    
    # Get or create test company
    company, _ = Company.objects.get_or_create(
        name='Test Company',
        defaults={'currency': 'KES', 'vat_rate': 16}
    )
    
    # Get or create test branch
    branch, _ = Branch.objects.get_or_create(
        company=company,
        code='TEST',
        defaults={'name': 'Test Branch', 'location': 'Test Location'}
    )
    
    users_data = [
        {
            'username': 'superadmin',
            'password': 'superadmin123',
            'email': 'superadmin@example.com',
            'pin': '1111',
            'role': 'admin',
            'access_level': 'super_admin',
            'is_staff': True,
            'is_superuser': True,
        },
        {
            'username': 'companyadmin',
            'password': 'companyadmin123',
            'email': 'companyadmin@example.com',
            'pin': '2222',
            'role': 'admin',
            'access_level': 'company_admin',
            'is_staff': True,
            'is_superuser': False,
        },
        {
            'username': 'branchadmin',
            'password': 'branchadmin123',
            'email': 'branchadmin@example.com',
            'pin': '3333',
            'role': 'admin',
            'access_level': 'branch_admin',
            'is_staff': True,
            'is_superuser': False,
        },
        {
            'username': 'cashier',
            'password': 'cashier123',
            'email': 'cashier@example.com',
            'pin': '4444',
            'role': 'cashier',
            'access_level': 'branch_staff',
            'is_staff': False,
            'is_superuser': False,
        },
        {
            'username': 'manager',
            'password': 'manager123',
            'email': 'manager@example.com',
            'pin': '5555',
            'role': 'manager',
            'access_level': 'branch_staff',
            'is_staff': False,
            'is_superuser': False,
        },
    ]
    
    for user_data in users_data:
        # Extract profile fields
        pin = user_data.pop('pin')
        role = user_data.pop('role')
        access_level = user_data.pop('access_level')
        
        # Create or update user
        user, created = User.objects.update_or_create(
            username=user_data['username'],
            defaults={k: v for k, v in user_data.items() if k != 'password'}
        )
        
        # Set password
        user.set_password(user_data['password'])
        user.save()
        
        # Create or update profile
        profile, profile_created = UserProfile.objects.update_or_create(
            user=user,
            defaults={
                'pin': pin,
                'role': role,
                'access_level': access_level,
                'company': company,
                'branch': branch,
                'is_active': True,
            }
        )
        
        status = "Created" if profile_created else "Updated"
        print(f"✓ {status}: {user.username} ({access_level})")

if __name__ == '__main__':
    create_test_users()
    print("\n✓ Test users created successfully!")
    print("\nTest User Credentials:")
    print("=" * 50)
    print("Super Admin:  superadmin / superadmin123 (PIN: 1111)")
    print("Company Admin: companyadmin / companyadmin123 (PIN: 2222)")
    print("Branch Admin: branchadmin / branchadmin123 (PIN: 3333)")
    print("Cashier:     cashier / cashier123 (PIN: 4444)")
    print("Manager:     manager / manager123 (PIN: 5555)")
```

Run the script:
```bash
python manage.py shell < create_test_users.py
```

## List Current Users and Their Access Levels

```python
from pos.models import UserProfile

# Get all users with their access levels
users = UserProfile.objects.select_related('user', 'company', 'branch').all()

print("\n{'Username':<20} {'Access Level':<15} {'Role':<12} {'Company':<20} {'Branch':<20}")
print("=" * 90)

for profile in users:
    print(f"{profile.user.username:<20} {profile.access_level:<15} {profile.role:<12} {profile.company.name if profile.company else 'N/A':<20} {profile.branch.name if profile.branch else 'N/A':<20}")
```

## Update User Access Level

```python
from pos.models import UserProfile

# Get user
profile = UserProfile.objects.get(user__username='cashier')

# Update access level
profile.access_level = 'branch_admin'
profile.save()

print(f"✓ Updated {profile.user.username} to {profile.access_level}")
```

## Disable User

```python
from pos.models import UserProfile

profile = UserProfile.objects.get(user__username='cashier')
profile.is_active = False
profile.save()

print(f"✓ Disabled {profile.user.username}")
```

## Delete User

```python
from django.contrib.auth import get_user_model

User = get_user_model()

user = User.objects.get(username='cashier')
user.delete()

print(f"✓ Deleted user: cashier")
```

## Export User List

```python
from pos.models import UserProfile
import csv

# Query all users
profiles = UserProfile.objects.select_related('user', 'company', 'branch').all()

# Export to CSV
with open('users_export.csv', 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['Username', 'Email', 'Access Level', 'Role', 'Company', 'Branch', 'Active'])
    
    for profile in profiles:
        writer.writerow([
            profile.user.username,
            profile.user.email,
            profile.access_level,
            profile.role,
            profile.company.name if profile.company else '',
            profile.branch.name if profile.branch else '',
            'Yes' if profile.is_active else 'No'
        ])

print("✓ Exported users to users_export.csv")
```

## Test User Permissions

```python
from pos.models import UserProfile
from pos.views import is_super_admin, is_company_admin, is_branch_admin

# Get test user
user = User.objects.get(username='companyadmin')

# Check permissions
print(f"User: {user.username}")
print(f"Is Super Admin: {is_super_admin(user)}")
print(f"Is Company Admin: {is_company_admin(user)}")
print(f"Is Branch Admin: {is_branch_admin(user)}")
```

## Common Access Level Scenarios

### Scenario 1: Single Company, Multiple Branches
```python
# Company Admin for HQ Company can manage all branches
company = Company.objects.get(name='HQ')
UserProfile.objects.create(
    user=User.objects.get(username='companyadmin'),
    access_level='company_admin',
    company=company,
    branch=company.branches.first(),
)
```

### Scenario 2: Multiple Companies, Branch Admins
```python
# Branch Admin for Nairobi Branch
branch = Branch.objects.get(code='NAIROBI')
UserProfile.objects.create(
    user=User.objects.get(username='branch_manager'),
    access_level='branch_admin',
    company=branch.company,
    branch=branch,
)

# Branch Admin for Mombasa Branch
branch = Branch.objects.get(code='MOMBASA')
UserProfile.objects.create(
    user=User.objects.get(username='mombasa_manager'),
    access_level='branch_admin',
    company=branch.company,
    branch=branch,
)
```

### Scenario 3: Cashiers at Specific Branch
```python
# Multiple cashiers at same branch
branch = Branch.objects.get(code='MAIN')
for i in range(3):
    user = User.objects.create_user(
        username=f'cashier_{i+1}',
        password='pass123'
    )
    UserProfile.objects.create(
        user=user,
        access_level='branch_staff',
        role='cashier',
        company=branch.company,
        branch=branch,
    )
```

## Migration Notes

- If migrating existing users, set `access_level` based on their current `role`:
  - `ADMIN` role → `company_admin` (default) or `super_admin` (for top-level admins)
  - Others → `branch_staff`

- Set company field for all users:
  ```python
  from pos.models import UserProfile
  
  for profile in UserProfile.objects.all():
      if profile.branch:
          profile.company = profile.branch.company
          profile.save()
  ```
