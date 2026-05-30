# Deployment Checklist: Role-Based Access Control

## Pre-Deployment

- [ ] Review the RBAC documentation (`ROLE_BASED_ACCESS_CONTROL.md`)
- [ ] Understand the 4 access levels (Super Admin, Company Admin, Branch Admin, Branch Staff)
- [ ] Plan user role allocations for your organization
- [ ] Backup your database before applying migrations
- [ ] Test in development environment first

## Backend Deployment

### Migration Application
- [ ] Navigate to backend directory: `cd backend`
- [ ] Run migrations: `python manage.py migrate`
- [ ] Verify migration success (no errors in output)
- [ ] Check database for new `access_level` and `company` columns in `pos_userprofile` table

### User Setup
- [ ] Create test users with different access levels:
  - [ ] 1 Super Admin user
  - [ ] 1 Company Admin user
  - [ ] 1 Branch Admin user
  - [ ] 1 Branch Staff user
- [ ] Assign each user to appropriate company/branch
- [ ] Test login with each user type

### API Testing
- [ ] Test login endpoint returns `access_level` in response
- [ ] Test super admin can use switch company endpoint
- [ ] Test company admin can use switch branch endpoint
- [ ] Test branch staff cannot switch (returns 403)
- [ ] Verify audit logs record all switches

### Backend Server
- [ ] Restart Django development server
- [ ] Check for any errors in logs
- [ ] Verify API is responding correctly

## Frontend Deployment

### Component Updates
- [ ] Verify `CompanyBranchSwitcher` displays correctly for each access level
- [ ] Test that company dropdown only shows for super admins
- [ ] Test that branch dropdown shows for company admins
- [ ] Test that static displays show for branch staff

### AuthContext Testing
- [ ] Test `useAuth()` hook provides all new properties
- [ ] Verify access level checks work correctly:
  - [ ] `isSuperAdmin` returns true for super admin
  - [ ] `isCompanyAdmin` returns true for company admin and above
  - [ ] `isBranchAdmin` returns true for branch admin and above
  - [ ] `canSwitchBranch` returns true for admins
  - [ ] `canSwitchCompany` returns true for super admin only

### Switching Functionality
- [ ] Test super admin can switch companies
- [ ] Test company admin can switch branches
- [ ] Test branch staff cannot switch (UI disabled)
- [ ] Verify reload signal triggers data refresh
- [ ] Check that backend permissions match UI restrictions

### Browser Testing
- [ ] Test in Chrome/Firefox/Safari
- [ ] Test on desktop and mobile (if applicable)
- [ ] Check console for any JavaScript errors
- [ ] Verify localStorage has updated session data

## Integration Testing

### Cross-Component Testing
- [ ] Switch company/branch, then reload page - verify persistence
- [ ] Switch company/branch, then navigate to different page - verify context maintained
- [ ] Open multiple tabs, switch in one, verify sync in other (if using same session)
- [ ] Test with different network speeds

### Error Handling
- [ ] Test switching to non-existent company (should get 400)
- [ ] Test switching to company outside user's scope (should get 403)
- [ ] Test switching while offline (should show error)
- [ ] Test with invalid API token (should redirect to login)

### Audit Trail
- [ ] Verify all branch/company switches logged to `AuditLog`
- [ ] Check log entries have correct timestamps
- [ ] Verify audit logs respect access controls

## Security Verification

- [ ] ✅ Super admins can see all companies
- [ ] ✅ Company admins cannot access other companies
- [ ] ✅ Branch staff cannot switch branch/company
- [ ] ✅ API validates access level before returning data
- [ ] ✅ Audit logs track all switches

## Performance Testing

- [ ] Load time with large number of companies (100+)
- [ ] Load time with large number of branches (1000+)
- [ ] Switch performance is responsive
- [ ] No memory leaks in browser (check DevTools)

## Documentation

- [ ] ✅ ROLE_BASED_ACCESS_CONTROL.md created
- [ ] ✅ RBAC_IMPLEMENTATION_SUMMARY.md created
- [ ] ✅ RBAC_QUICK_REFERENCE.md created
- [ ] [ ] Share documentation with development team
- [ ] [ ] Update team wiki/knowledge base
- [ ] [ ] Create user guide for admin panel (if applicable)

## Production Deployment

### Pre-Production
- [ ] Test in staging environment with production-like data volume
- [ ] Verify all existing users have access_level assigned
- [ ] Create admin users with appropriate access levels
- [ ] Test with production database backup
- [ ] Get approval from management

### Deployment Day
- [ ] Schedule maintenance window
- [ ] Backup production database
- [ ] Apply migrations to production
- [ ] Deploy updated code
- [ ] Verify no errors in production logs
- [ ] Test critical user workflows
- [ ] Monitor for performance issues

### Post-Deployment
- [ ] Monitor error logs for 24 hours
- [ ] Check API response times are normal
- [ ] Verify all users can login
- [ ] Test branch/company switching in production
- [ ] Get feedback from initial users
- [ ] Have rollback plan ready (for 1 week)

## Rollback Plan (If Needed)

If critical issues occur:
1. Restore database from backup
2. Revert code to previous version
3. Restart Django server
4. Notify users of temporary maintenance

Access level queries will still work on old code (fields exist but aren't used).

## Post-Launch

### Week 1
- [ ] Daily log monitoring
- [ ] User feedback collection
- [ ] Performance baseline recording

### Week 2-4
- [ ] Address any reported issues
- [ ] Optimize slow queries if needed
- [ ] Train additional admins on role management

### Ongoing
- [ ] Regular audit log review
- [ ] Performance monitoring
- [ ] Security updates as needed

## Troubleshooting Checklist

### If migration fails:
- [ ] Check database connection
- [ ] Verify Django version compatibility
- [ ] Check for conflicting migrations
- [ ] Run `python manage.py showmigrations pos`

### If API returns 403:
- [ ] Verify user access_level is set
- [ ] Check user is assigned to company/branch
- [ ] Verify is_active=True on all entities

### If frontend not updating:
- [ ] Clear browser cache
- [ ] Check localStorage for session
- [ ] Verify AuthContext is providing data
- [ ] Check network tab for API responses

### If switches aren't working:
- [ ] Verify backend endpoint exists
- [ ] Check API URL in frontend config
- [ ] Look for JavaScript errors in console
- [ ] Verify CORS if on different domain

## Support Contacts

- Backend Issues: [Backend Team]
- Frontend Issues: [Frontend Team]
- Database Issues: [Database Admin]
- Deployment Issues: [DevOps Team]

## Sign-Off

- [ ] Backend Lead: _________________
- [ ] Frontend Lead: _________________
- [ ] QA Lead: _________________
- [ ] Product Owner: _________________

---

**Deployment Date**: _______________  
**Deployed By**: _______________  
**Version**: _______________
