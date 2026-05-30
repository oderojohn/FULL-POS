import csv
import datetime
import io
from decimal import Decimal
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Count, Max, Q, Sum as DbSum
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status, viewsets
import logging
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .authentication import make_pos_token
from .models import (
    AuditLog,
    Branch,
    Category,
    Company,
    Customer,
    HeldOrder,
    HeldOrderItem,
    InventoryStock,
    Payment,
    Product,
    PurchaseOrder,
    Register,
    Sale,
    SaleItem,
    Shift,
    StocktakeSession,
    StockMovement,
    Supplier,
    UserProfile,
    MpesaStkLog,
    MpesaDirectPaymentLog,
)
from .permissions import (
    get_pos_profile,
    profile_company,
    user_can_access_branch,
)
from .serializers import (
    ApproveStocktakeSerializer,
    AuditLogSerializer,
    BranchSerializer,
    CategorySerializer,
    CompanySerializer,
    CompanySettingsSerializer,
    CustomerSerializer,
    UpdatePurchaseOrderSerializer,
    ReceivePurchaseOrderSerializer,
    HeldOrderSerializer,
    HoldOrderSerializer,
    UpdateHoldOrderSerializer,
    InventoryStockSerializer,
    LoginSerializer,
    OpenShiftSerializer,
    CloseShiftSerializer,
    CreatePurchaseOrderSerializer,
    CreateStocktakeSerializer,
    CountStocktakeSerializer,
    CashTransactionSerializer,
    MpesaDirectLookupSerializer,
    MpesaDirectPaymentLogSerializer,
    MpesaStkPushSerializer,
    MpesaStkQuerySerializer,
    ReprintReceiptSerializer,
    MpesaStkLogSerializer,
    ProductSerializer,
    PurchaseOrderSerializer,
    ReceiptCopySerializer,
    RegisterSerializer,
    SaleSerializer,
    ShiftSerializer,
    StockAdjustmentSerializer,
    StockMovementSerializer,
    SwitchBranchSerializer,
    StocktakeItemSerializer,
    StocktakeSessionSerializer,
    SupplierSerializer,
    UserProfileSerializer,
    VoidSaleSerializer,
    ReceiptCopySerializer,
    CheckoutSerializer,
)
from .services import (
    adjust_stock,
    cancel_purchase_order,
    checkout_sale,
    close_shift,
    create_purchase_order,
    create_stocktake,
    receive_purchase_order,
    reprint_receipt,
    count_stocktake,
    approve_stocktake,
    update_purchase_order,
    void_sale,
    ensure_default_register,
)

logger = logging.getLogger(__name__)

from .rbac import (
    ADMIN_SECTION_PERMISSIONS,
    can_access_admin_section,
    permissions_for_profile,
    role_permission_matrix,
)


def _positive_int_value(value, name):
    if value in (None, "", "undefined", "null"):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError({name: "Expected a numeric id."}) from exc
    if parsed <= 0:
        raise ValidationError({name: "Expected a positive numeric id."})
    return parsed


def _positive_int_query_param(query_params, name):
    return _positive_int_value(query_params.get(name), name)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _csv_response(filename, header, rows):
    """Return a DRF Response with a CSV attachment."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    for row in rows:
        writer.writerow(row)
    buffer.seek(0)
    response = Response(buffer.getvalue(), content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response

def _pdf_response(filename, title, headers, rows):
    """Return a PDF response (using reportlab if available, otherwise HTML)."""
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter, A4
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import inch
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        elements = []
        
        # Add title
        elements.append(Paragraph(title, styles['Title']))
        elements.append(Paragraph(" ", styles['Normal']))  # spacer
        
        # Prepare table data
        data = [headers]
        for row in rows:
            data.append([str(cell) for cell in row])
        
        # Create table
        table = Table(data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        elements.append(table)
        doc.build(elements)
        
        buffer.seek(0)
        response = Response(buffer.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
        
    except ImportError:
        # Fallback to HTML if reportlab is not available
        html = f'''<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{title}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        h1 {{ color: #1e293b; }}
        table {{ border-collapse: collapse; width: 100%; margin-top: 20px; }}
        th, td {{ border: 1px solid #e2e8f0; padding: 8px; text-align: left; font-size: 12px; }}
        th {{ background: #f1f5f9; }}
    </style>
</head>
<body>
    <h1>{title}</h1>
    <table>
        <thead>
            <tr>
                {''.join(f'<th>{h}</th>' for h in headers)}
            </tr>
        </thead>
        <tbody>
            {''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in row) + '</tr>' for row in rows)}
        </tbody>
    </table>
</body>
</html>'''
        response = Response(html, content_type="text/html")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

def is_super_admin(user):
    """Check if user is a super admin."""
    if not user.is_authenticated:
        return False
    profile = get_pos_profile(user)
    return bool(
        user.is_superuser
        or (profile and profile.access_level == UserProfile.SUPER_ADMIN)
    )


def is_company_admin(user):
    """Check if user is a company admin (can manage all branches in company)."""
    if not user.is_authenticated:
        return False
    profile = get_pos_profile(user)
    return bool(
        is_super_admin(user)
        or (profile and profile.access_level in [UserProfile.COMPANY_ADMIN, UserProfile.SUPER_ADMIN])
    )


def is_branch_admin(user):
    """Check if user is a branch admin (can manage their assigned branch)."""
    if not user.is_authenticated:
        return False
    profile = get_pos_profile(user)
    return bool(
        is_company_admin(user)
        or (profile and profile.access_level in [UserProfile.BRANCH_ADMIN, UserProfile.COMPANY_ADMIN, UserProfile.SUPER_ADMIN])
    )


def _active_branch(user):
    """Return the Branch the user is currently operating in, or None."""
    profile = get_pos_profile(user)
    return profile.branch if (profile and profile.branch_id) else None


def _active_company(user):
    return profile_company(get_pos_profile(user))


def _branch_filter_kwargs(branch_field, branch):
    if branch_field == "id":
        return {"id": branch.id}
    return {f"{branch_field}_id": branch.id}


def _get_active_branch_by_id(branch_id):
    branch = Branch.objects.select_related("company").filter(pk=branch_id, is_active=True).first()
    if not branch:
        raise ValidationError({"branch": "Branch not found or inactive."})
    return branch


def _resolve_read_branch(request):
    branch_id = _positive_int_query_param(request.query_params, "branch")
    if branch_id is not None:
        branch = _get_active_branch_by_id(branch_id)
        if not user_can_access_branch(request.user, branch):
            raise PermissionDenied("You do not have access to this branch.")
        return branch

    branch = _active_branch(request.user)
    if branch and user_can_access_branch(request.user, branch):
        return branch
    return None


def _resolve_write_branch(request):
    branch_id = _positive_int_value(
        request.data.get("branch") or request.query_params.get("branch"),
        "branch",
    )
    branch = _get_active_branch_by_id(branch_id) if branch_id is not None else _active_branch(request.user)

    if not branch:
        profile = get_pos_profile(request.user)
        company = profile.company if profile else None
        if company:
            company_branches = Branch.objects.filter(company=company, is_active=True)
            if company_branches.count() == 1:
                branch = company_branches.first()
    if not branch:
        raise ValidationError({"branch": "Active branch is required."})
    if not user_can_access_branch(request.user, branch):
        raise PermissionDenied("You do not have access to this branch.")
    return branch


def _filter_branch_scoped_queryset(queryset, request, branch_field="branch"):
    branch = _resolve_read_branch(request)
    if not branch:
        return queryset.none()
    return queryset.filter(**_branch_filter_kwargs(branch_field, branch))


def _audit(request, action, entity, entity_id, branch=None, notes=""):
    AuditLog.objects.create(
        user=request.user if request.user.is_authenticated else None,
        action=action,
        entity=entity,
        entity_id=str(entity_id),
        branch=branch,
        notes=notes,
    )


def _changed_fields(instance, serializer, fields):
    changes = []
    for field in fields:
        if field not in serializer.validated_data:
            continue
        old_value = getattr(instance, field, None)
        new_value = serializer.validated_data[field]
        if old_value != new_value:
            changes.append(f"{field}: {old_value} -> {new_value}")
    return "; ".join(changes)


def _build_context_payload(profile):
    """
    Build the full company + branch context block.
    Returned on login and whenever the admin switches branch.
    The frontend should reload all branch-scoped data when it receives this.
    Access to branches depends on the user's access level.
    """
    branch = profile.branch
    company = profile.company or (branch.company if branch else None)
    user = profile.user
    
    # Determine which branches to show based on access level
    if profile.access_level == UserProfile.SUPER_ADMIN:
        # Super admins can see all branches
        sibling_branches = Branch.objects.filter(is_active=True)
    elif profile.access_level == UserProfile.COMPANY_ADMIN:
        # Company admins see all branches in their company
        sibling_branches = (
            Branch.objects.filter(company=company, is_active=True)
            if company else Branch.objects.none()
        )
    else:
        # Branch staff and branch admins only see their assigned branch
        sibling_branches = (
            Branch.objects.filter(id=branch.id, is_active=True)
            if branch else Branch.objects.none()
        )
    
    return {
        "company": CompanySerializer(company).data if company else None,
        "branch": BranchSerializer(branch).data if branch else None,
        "company_branches": BranchSerializer(sibling_branches, many=True).data,
        "access_level": profile.access_level,
    }


def _auth_permissions_payload(profile, user):
    permissions = permissions_for_profile(profile)
    if user.is_superuser or (profile.role == UserProfile.ADMIN and not profile.use_custom_permissions):
        permissions = ["*"]
    admin_sections = {
        name: can_access_admin_section(permissions, name)
        for name in ADMIN_SECTION_PERMISSIONS
    }
    return {"permissions": permissions, "admin_sections": admin_sections}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@method_decorator(csrf_exempt, name="dispatch")
class AuthViewSet(viewsets.ViewSet):
    def get_permissions(self):
        if self.action == "login":
            return [AllowAny()]
        return [IsAuthenticated()]

    def _ensure_dev_cashier(self, username):
        if not settings.DEBUG or username != "cashier":
            return
        user_model = get_user_model()
        user, created = user_model.objects.get_or_create(
            username="cashier", defaults={"is_staff": True}
        )
        if created or not user.check_password("cashier123"):
            user.set_password("cashier123")
            user.is_staff = True
            user.save(update_fields=["password", "is_staff"])
        company, _ = Company.objects.get_or_create(
            name="Demo Company",
            defaults={"currency": "KES", "vat_rate": 16},
        )
        branch = Branch.objects.filter(company=company).order_by("id").first()
        if not branch:
            branch = Branch.objects.create(
                company=company, code="MAIN", name="Main Branch"
            )
        UserProfile.objects.update_or_create(
            user=user,
            defaults={
                "pin": "1234",
                "role": UserProfile.ADMIN,
                "access_level": UserProfile.SUPER_ADMIN,
                "branch": branch,
                "company": company,
                "is_active": True
            },
        )

    @action(detail=False, methods=["post"])
    def login(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data["username"]
        password = serializer.validated_data.get("password", "")
        pin = serializer.validated_data.get("pin", "")
        self._ensure_dev_cashier(username)

        user = authenticate(request, username=username, password=password) if password else None
        if user is None and pin:
            profile = (
                UserProfile.objects
                .select_related("user")
                .filter(user__username=username, pin=pin, is_active=True)
                .first()
            )
            user = profile.user if profile else None

        if user is None or not user.is_active:
            return Response(
                {"detail": "Invalid username, password, or PIN."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile, _ = UserProfile.objects.get_or_create(
            user=user,
            defaults={"role": UserProfile.ADMIN if user.is_superuser else UserProfile.CASHIER},
        )
        if not profile.is_active:
            return Response(
                {"detail": "POS profile is inactive."},
                status=status.HTTP_403_FORBIDDEN,
            )

        auth_perms = _auth_permissions_payload(profile, user)

        return Response({
            "user": {
                "id": user.id,
                "username": user.username,
                "full_name": user.get_full_name(),
                "is_superuser": user.is_superuser,
            },
            "profile": UserProfileSerializer(profile).data,
            "permissions": auth_perms["permissions"],
            "admin_sections": auth_perms["admin_sections"],
            "token": make_pos_token(user),
            # Full company + branch context so the frontend can bootstrap immediately.
            **_build_context_payload(profile),
        })

    @action(detail=False, methods=["get"])
    def me(self, request):
        profile = get_pos_profile(request.user)
        if not request.user.is_active or not profile or not profile.is_active:
            return Response(
                {"detail": "Your POS account is inactive."},
                status=status.HTTP_403_FORBIDDEN,
            )
        auth_perms = _auth_permissions_payload(profile, request.user)
        return Response({
            "user": {
                "id": request.user.id,
                "username": request.user.username,
                "full_name": request.user.get_full_name(),
                "is_superuser": request.user.is_superuser,
            },
            "profile": UserProfileSerializer(profile).data,
            "permissions": auth_perms["permissions"],
            "admin_sections": auth_perms["admin_sections"],
            **_build_context_payload(profile),
        })

    @action(detail=False, methods=["post"], url_path="switch-branch")
    def switch_branch(self, request):
        """
        Branch/company switching based on access level:
        - SUPER_ADMIN: Can switch to any branch
        - COMPANY_ADMIN: Can switch to any branch in their company
        - BRANCH_ADMIN: Can only work in their assigned branch
        - BRANCH_STAFF: Can only work in their assigned branch

        POST  /auth/switch-branch/
        Body: { "branch": <branch_id> }
        """
        if not is_company_admin(request.user):
            return Response(
                {"detail": "Only company admins or super admins can switch branch."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = SwitchBranchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        profile = get_pos_profile(request.user)
        if not profile:
            return Response(
                {"detail": "No POS profile found."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_branch_id = serializer.validated_data["branch"]

        # Build query based on access level
        branch_qs = Branch.objects.select_related("company").filter(
            pk=new_branch_id, is_active=True
        )
        
        # Super admins can switch to any branch
        if profile.access_level == UserProfile.SUPER_ADMIN:
            pass  # No additional filtering
        # Company admins can only switch within their company
        elif profile.access_level == UserProfile.COMPANY_ADMIN:
            branch_qs = branch_qs.filter(company=profile.company)
        else:
            # Others cannot switch
            return Response(
                {"detail": "You do not have permission to switch branches."},
                status=status.HTTP_403_FORBIDDEN,
            )

        branch = branch_qs.first()
        if not branch:
            return Response(
                {"detail": "Branch not found, inactive, or outside your access scope."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_branch = profile.branch
        old_company = profile.company
        profile.branch = branch
        profile.company = branch.company
        profile.save(update_fields=["branch", "company", "updated_at"])

        AuditLog.objects.create(
            user=request.user,
            action="admin.switch_branch",
            entity="UserProfile",
            entity_id=str(profile.id),
            branch=branch,
            notes=f"Switched from branch={old_branch.id if old_branch else None} to branch={branch.id}",
        )

        return Response({
            "profile": UserProfileSerializer(profile).data,
            "reload": True,
            **_auth_permissions_payload(profile, request.user),
            **_build_context_payload(profile),
        })

    @action(detail=False, methods=["post"], url_path="switch-company")
    def switch_company(self, request):
        """
        Switch to a different company (only for super admins).

        POST  /auth/switch-company/
        Body: { "company": <company_id> }
        """
        if not is_super_admin(request.user):
            return Response(
                {"detail": "Only super admins can switch company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        company_id = request.data.get("company")
        if not company_id:
            return Response(
                {"detail": "company_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile = get_pos_profile(request.user)
        if not profile:
            return Response(
                {"detail": "No POS profile found."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        company = Company.objects.filter(pk=company_id, is_active=True).first()
        if not company:
            return Response(
                {"detail": "Company not found or inactive."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get first active branch in this company
        branch = Branch.objects.filter(company=company, is_active=True).first()
        if not branch:
            return Response(
                {"detail": "No active branches in this company."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_company = profile.company
        profile.company = company
        profile.branch = branch
        profile.save(update_fields=["company", "branch", "updated_at"])

        AuditLog.objects.create(
            user=request.user,
            action="admin.switch_company",
            entity="UserProfile",
            entity_id=str(profile.id),
            branch=branch,
            notes=f"Switched from company={old_company.id if old_company else None} to company={company.id}",
        )

        return Response({
            "profile": UserProfileSerializer(profile).data,
            "reload": True,
            **_auth_permissions_payload(profile, request.user),
            **_build_context_payload(profile),
        })


# ---------------------------------------------------------------------------
# User Profiles
# ---------------------------------------------------------------------------

class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.select_related("user", "branch__company")
    serializer_class = UserProfileSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        branch_param = _positive_int_query_param(self.request.query_params, "branch")

        if is_super_admin(user):
            return queryset.filter(branch_id=branch_param) if branch_param is not None else queryset

        company = _active_company(user)
        if is_company_admin(user) and company:
            queryset = queryset.filter(Q(company=company) | Q(branch__company=company))
            if branch_param is not None:
                branch = _get_active_branch_by_id(branch_param)
                if branch.company_id != company.id:
                    return queryset.none()
                queryset = queryset.filter(branch=branch)
            return queryset

        branch = _active_branch(user)
        if branch_param is not None and (not branch or branch_param != branch.id):
            return queryset.none()
        return queryset.filter(branch=branch) if branch else queryset.none()

    def _ensure_can_manage_users(self):
        if not is_branch_admin(self.request.user):
            raise PermissionDenied("Only branch admins, company admins, or super admins can manage POS users.")

    def _ensure_profile_scope(self, profile):
        actor = self.request.user
        if is_super_admin(actor):
            return

        if profile.access_level == UserProfile.SUPER_ADMIN:
            raise PermissionDenied("Only super admins can grant super-admin access.")

        actor_company = _active_company(actor)
        if is_company_admin(actor):
            profile_company_id = profile.company_id or (profile.branch.company_id if profile.branch_id else None)
            if not actor_company or profile_company_id != actor_company.id:
                raise PermissionDenied("You can only manage users in your company.")
            return

        actor_branch = _active_branch(actor)
        if (
            profile.access_level in [UserProfile.COMPANY_ADMIN, UserProfile.SUPER_ADMIN]
            or not actor_branch
            or profile.branch_id != actor_branch.id
        ):
            raise PermissionDenied("Branch admins can only manage staff in their branch.")

    def _ensure_profile_scope_data(self, serializer):
        actor = self.request.user
        if is_super_admin(actor):
            return

        access_level = serializer.validated_data.get(
            "access_level",
            getattr(serializer.instance, "access_level", UserProfile.BRANCH_STAFF),
        )
        branch = serializer.validated_data.get("branch") or getattr(serializer.instance, "branch", None)
        company = serializer.validated_data.get("company") or getattr(serializer.instance, "company", None)
        custom_permissions = serializer.validated_data.get("custom_permissions", None)

        if access_level == UserProfile.SUPER_ADMIN:
            raise PermissionDenied("Only super admins can grant super-admin access.")
        if custom_permissions and ("admin.super" in custom_permissions or "admin.company" in custom_permissions):
            raise PermissionDenied("Only super admins can grant system-wide administration permissions.")

        if is_company_admin(actor):
            actor_company = _active_company(actor)
            target_company = company or (branch.company if branch else None)
            if not actor_company or not target_company or target_company.id != actor_company.id:
                raise PermissionDenied("You can only manage users in your company.")
            return

        actor_branch = _active_branch(actor)
        if (
            access_level in [UserProfile.COMPANY_ADMIN, UserProfile.SUPER_ADMIN]
            or not actor_branch
            or not branch
            or branch.id != actor_branch.id
        ):
            raise PermissionDenied("Branch admins can only manage staff in their branch.")

    def perform_create(self, serializer):
        self._ensure_can_manage_users()
        self._ensure_profile_scope_data(serializer)
        profile = serializer.save()
        self._ensure_profile_scope(profile)
        AuditLog.objects.create(
            user=self.request.user,
            action="admin.user.create",
            entity="UserProfile",
            entity_id=str(profile.id),
            branch=profile.branch,
            notes=f"Created POS user {profile.user.username}",
        )

    def perform_update(self, serializer):
        self._ensure_can_manage_users()
        self._ensure_profile_scope_data(serializer)
        profile = serializer.save()
        self._ensure_profile_scope(profile)
        AuditLog.objects.create(
            user=self.request.user,
            action="admin.user.update",
            entity="UserProfile",
            entity_id=str(profile.id),
            branch=profile.branch,
            notes=f"Updated POS user {profile.user.username}",
        )

    def perform_destroy(self, instance):
        self._ensure_can_manage_users()
        self._ensure_profile_scope(instance)
        username = instance.user.username
        branch = instance.branch
        user = instance.user
        instance.delete()
        user.delete()
        AuditLog.objects.create(
            user=self.request.user,
            action="admin.user.delete",
            entity="UserProfile",
            entity_id=str(instance.id),
            branch=branch,
            notes=f"Deleted POS user {username}",
        )

    @action(detail=False, methods=["get"], url_path="role-options")
    def role_options(self, request):
        matrix = role_permission_matrix()
        return Response({
            "roles": matrix["roles"],
            "access_levels": [{"value": value, "label": label} for value, label in UserProfile.ACCESS_LEVEL_CHOICES],
            "permissions": {row["role"]: row["permissions"] for row in matrix["matrix"]},
            "permission_catalog": matrix["catalog"],
            "role_matrix": matrix["matrix"],
        })


# ---------------------------------------------------------------------------
# Company  (read-only for non-admins; admins manage via Django admin or API)
# ---------------------------------------------------------------------------

class CompanyViewSet(viewsets.ModelViewSet):
    queryset = Company.objects.filter(is_active=True)
    serializer_class = CompanySerializer

    def get_queryset(self):
        user = self.request.user
        queryset = self.queryset
        company_id = _positive_int_query_param(self.request.query_params, "company")

        if is_super_admin(user):
            return queryset.filter(id=company_id) if company_id is not None else queryset

        company = _active_company(user)
        if company:
            if company_id is not None and company_id != company.id:
                return queryset.none()
            return queryset.filter(id=company.id)
        return queryset.none()

    def perform_create(self, serializer):
        if not is_super_admin(self.request.user):
            raise PermissionDenied("Only super admins can create companies.")
        company = serializer.save()
        _audit(self.request, "admin.company.create", "Company", company.id, notes=f"Created company {company.name}")

    def perform_update(self, serializer):
        if not is_super_admin(self.request.user):
            raise PermissionDenied("Only super admins can update companies.")
        changes = _changed_fields(serializer.instance, serializer, ["name", "currency", "vat_rate", "is_active"])
        company = serializer.save()
        _audit(self.request, "admin.company.update", "Company", company.id, notes=changes or f"Updated company {company.name}")

    def perform_destroy(self, instance):
        if not is_super_admin(self.request.user):
            raise PermissionDenied("Only super admins can delete companies.")
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])
        _audit(self.request, "admin.company.delete", "Company", instance.id, notes=f"Deactivated company {instance.name}")


# ---------------------------------------------------------------------------
# Branch
# ---------------------------------------------------------------------------

class BranchViewSet(viewsets.ModelViewSet):
    queryset = Branch.objects.select_related("company").filter(is_active=True)
    serializer_class = BranchSerializer

    def get_queryset(self):
        user = self.request.user
        company_id = _positive_int_query_param(self.request.query_params, "company")
        queryset = self.queryset

        if is_super_admin(user):
            return queryset.filter(company_id=company_id) if company_id is not None else queryset

        company = _active_company(user)
        if is_company_admin(user) and company:
            if company_id is not None and company_id != company.id:
                return queryset.none()
            return queryset.filter(company_id=company.id)

        branch = _active_branch(user)
        if not branch:
            return queryset.none()
        return queryset.filter(id=branch.id)

    def perform_create(self, serializer):
        company = serializer.validated_data.get("company")
        if not is_super_admin(self.request.user):
            if not is_company_admin(self.request.user):
                raise PermissionDenied("Only company admins can create branches.")
            active_company = _active_company(self.request.user)
            if not active_company or company.id != active_company.id:
                raise PermissionDenied("You can only create branches in your company.")
        branch = serializer.save()
        ensure_default_register(branch)
        _audit(self.request, "admin.branch.create", "Branch", branch.id, branch=branch, notes=f"Created branch {branch.code}")

    def perform_update(self, serializer):
        company = serializer.validated_data.get("company", serializer.instance.company)
        if not is_super_admin(self.request.user):
            if not is_company_admin(self.request.user):
                raise PermissionDenied("Only company admins can update branches.")
            active_company = _active_company(self.request.user)
            if not active_company or company.id != active_company.id:
                raise PermissionDenied("You can only update branches in your company.")
        changes = _changed_fields(serializer.instance, serializer, ["code", "name", "location", "company", "is_active"])
        branch = serializer.save()
        _audit(self.request, "admin.branch.update", "Branch", branch.id, branch=branch, notes=changes or f"Updated branch {branch.code}")

    def perform_destroy(self, instance):
        if not is_super_admin(self.request.user):
            if not is_company_admin(self.request.user):
                raise PermissionDenied("Only company admins can delete branches.")
            active_company = _active_company(self.request.user)
            if not active_company or instance.company_id != active_company.id:
                raise PermissionDenied("You can only delete branches in your company.")
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])
        _audit(self.request, "admin.branch.delete", "Branch", instance.id, branch=instance, notes=f"Deactivated branch {instance.code}")


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------

class RegisterViewSet(viewsets.ModelViewSet):
    queryset = Register.objects.select_related("branch__company")
    serializer_class = RegisterSerializer

    def get_queryset(self):
        return _filter_branch_scoped_queryset(super().get_queryset(), self.request)

    @action(detail=False, methods=["post"], url_path="ensure-default")
    def ensure_default(self, request):
        branch = _resolve_write_branch(request)
        register = ensure_default_register(branch)
        return Response(RegisterSerializer(register).data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Category
# ---------------------------------------------------------------------------

class CategoryViewSet(viewsets.ModelViewSet):
    # Ensure category creation assigns a valid branch from write context
    

    queryset = Category.objects.filter(is_active=True).select_related("branch__company")
    serializer_class = CategorySerializer

    def get_queryset(self):
        queryset = _filter_branch_scoped_queryset(super().get_queryset(), self.request)
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset

    def perform_create(self, serializer):
        category = serializer.save(branch=self._resolve_branch())
        _audit(self.request, "inventory.category.create", "Category", category.id, branch=category.branch, notes=f"Created category {category.name}")

    def perform_update(self, serializer):
        changes = _changed_fields(serializer.instance, serializer, ["name", "color", "is_active"])
        category = serializer.save()
        _audit(self.request, "inventory.category.update", "Category", category.id, branch=category.branch, notes=changes or f"Updated category {category.name}")

    def perform_destroy(self, instance):
        if instance.products.filter(is_active=True).exists():
            raise ValidationError({"category": "Deactivate or move products before deleting this category."})
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])
        _audit(self.request, "inventory.category.delete", "Category", instance.id, branch=instance.branch, notes=f"Deactivated category {instance.name}")

    def _resolve_branch(self):
        return _resolve_write_branch(self.request)


# ---------------------------------------------------------------------------
# Product
# ---------------------------------------------------------------------------

class ProductViewSet(viewsets.ModelViewSet):
    queryset = (
        Product.objects
        .filter(is_active=True)
        .select_related("branch__company", "category")
        .prefetch_related("stock_rows")
    )
    serializer_class = ProductSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        branch = (
            _resolve_write_branch(self.request)
            if self.action in {"create", "update", "partial_update"}
            else _resolve_read_branch(self.request)
        )
        context["branch_id"] = branch.id if branch else None
        return context

    def get_queryset(self):
        queryset = _filter_branch_scoped_queryset(super().get_queryset(), self.request)
        search = self.request.query_params.get("search")
        category = self.request.query_params.get("category")
        barcode = self.request.query_params.get("barcode")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(sku__icontains=search) | Q(barcode__icontains=search)
            )
        if category:
            queryset = queryset.filter(category_id=category)
        if barcode:
            queryset = queryset.filter(barcode=barcode)
        return queryset

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        branch = self._resolve_branch()
        initial_stock = int(request.data.get("initial_stock") or 0)
        user_id = request.data.get("user")

        if initial_stock < 0:
            return Response(
                {"initial_stock": "Opening stock cannot be negative."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = serializer.save(branch=branch)
        _audit(request, "inventory.product.create", "Product", product.id, branch=branch, notes=f"Created product {product.sku}")

        if initial_stock:
            user = get_user_model().objects.filter(pk=user_id).first() if user_id else None
            stock, _ = InventoryStock.objects.select_for_update().get_or_create(
                branch=branch,
                product=product,
                defaults={"quantity": 0},
            )
            stock.quantity += initial_stock
            stock.save(update_fields=["quantity", "updated_at"])
            StockMovement.objects.create(
                branch=branch,
                product=product,
                quantity_delta=initial_stock,
                reason=StockMovement.ADJUSTMENT,
                reference="Opening stock",
                user=user,
            )
            AuditLog.objects.create(
                user=user,
                action="product.create_with_opening_stock",
                entity="Product",
                entity_id=str(product.id),
                branch=branch,
                notes=f"Opening stock: {initial_stock}",
            )

        headers = self.get_success_headers(serializer.data)
        return Response(self.get_serializer(product).data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_update(self, serializer):
        fields = [
            "name", "sku", "barcode", "category", "retail_price", "wholesale_price",
            "cost_price", "tax_rate", "reorder_point", "is_active",
        ]
        changes = _changed_fields(serializer.instance, serializer, fields)
        product = serializer.save()
        _audit(self.request, "inventory.product.update", "Product", product.id, branch=product.branch, notes=changes or f"Updated product {product.sku}")

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])
        _audit(self.request, "inventory.product.delete", "Product", instance.id, branch=instance.branch, notes=f"Deactivated product {instance.sku}")

    def _resolve_branch(self):
        return _resolve_write_branch(self.request)


# ---------------------------------------------------------------------------
# Inventory Stock
# ---------------------------------------------------------------------------

def _parse_iso_date(value):
    """Return a datetime.date from an ISO-format string, or None if invalid."""
    if not value:
        return None
    try:
        return datetime.date.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def _prev_month_str(ym):
    """Given 'YYYY-MM', return the previous month string."""
    year, month = int(ym[:4]), int(ym[5:7])
    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    return f"{prev_year:04d}-{prev_month:02d}"


class InventoryStockViewSet(viewsets.ModelViewSet):
    queryset = InventoryStock.objects.select_related("branch__company", "product")
    serializer_class = InventoryStockSerializer

    def get_queryset(self):
        return _filter_branch_scoped_queryset(super().get_queryset(), self.request)

    @action(detail=False, methods=["post"])
    def adjust(self, request):
        serializer = StockAdjustmentSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        stock = adjust_stock(**serializer.validated_data)
        return Response(InventoryStockSerializer(stock).data)

    @action(detail=False, methods=["get"], url_path="low-stock")
    def low_stock(self, request):
        queryset = self.get_queryset().filter(product__is_active=True)
        
        rows = [
            row for row in queryset.select_related("product")
            if row.quantity <= row.product.reorder_point
        ]
        return Response(InventoryStockSerializer(rows, many=True).data)

    # ------------------------------------------------------------------
    # Report endpoints
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"], url_path="stock-valuation")
    def stock_valuation(self, request):
        """Stock valuation report — per-item cost and retail values."""
        branch = _resolve_read_branch(request)
        qs = InventoryStock.objects.select_related("branch__company", "product__category").filter(
            product__is_active=True,
        )
        if branch:
            qs = qs.filter(branch=branch)

        category_id = request.query_params.get("category")
        if category_id:
            qs = qs.filter(product__category_id=category_id)

        start_date = _parse_iso_date(request.query_params.get("start_date"))
        end_date = _parse_iso_date(request.query_params.get("end_date"))
        if start_date:
            qs = qs.filter(updated_at__date__gte=start_date)
        if end_date:
            qs = qs.filter(updated_at__date__lte=end_date)

        products = Product.objects.filter(branch=branch).select_related("category") if branch else Product.objects.none()

        export_format = request.query_params.get("export")
        rows_data = []
        total_cost = 0
        total_retail = 0
        total_wholesale = 0

        for stock in qs.prefetch_related("product__category"):
            product = stock.product
            category_name = getattr(getattr(product, "category", None), "name", "—")
            cost = product.cost_price
            retail = product.retail_price
            wholesale = product.wholesale_price
            qty = stock.quantity
            value_cost = cost * qty
            value_retail = retail * qty
            value_wholesale = wholesale * qty
            total_cost += value_cost
            total_retail += value_retail
            total_wholesale += value_wholesale
            rows_data.append({
                "product_id": product.id,
                "product_name": product.name,
                "sku": product.sku,
                "category": category_name,
                "branch": stock.branch.code,
                "quantity": qty,
                "cost_price": str(cost),
                "retail_price": str(retail),
                "wholesale_price": str(wholesale),
                "value_at_cost": str(value_cost),
                "value_at_retail": str(value_retail),
                "value_at_wholesale": str(value_wholesale),
            })
        if export_format == "csv":
            csv_rows = [
                [r["product_name"], r["sku"], r["category"], r["branch"],
                 r["quantity"], r["cost_price"],
                 r["value_at_cost"], r["retail_price"],
                 r["value_at_retail"], r["wholesale_price"], r["value_at_wholesale"]]
                for r in rows_data
            ]
            return _csv_response(
                "stock_valuation.csv",
                ["Product", "SKU", "Category", "Branch",
                 "Quantity", "Cost Price",
                 "Value @ Cost", "Retail Price",
                 "Value @ Retail", "Wholesale Price", "Value @ Wholesale"],
                csv_rows,
            )
        if export_format == "pdf":
            pdf_rows = [
                [r["product_name"], r["sku"], r["category"], r["branch"],
                 r["quantity"], r["value_at_cost"]]
                for r in rows_data
            ]
            return _pdf_response(
                "stock_valuation.pdf",
                "Stock Valuation Report",
                ["Product", "SKU", "Category", "Branch", "Qty", "Value @ Cost"],
                pdf_rows,
            )
        return Response({
            "rows": rows_data,
            "summary": {
                "item_count": len(rows_data),
                "total_cost_value": str(total_cost),
                "total_retail_value": str(total_retail),
                "total_wholesale_value": str(total_wholesale),
            },
        })

    @action(detail=False, methods=["get"], url_path="fast-slow-moving")
    def fast_slow_moving(self, request):
        """Fast-moving vs slow-moving inventory report."""
        branch = _resolve_read_branch(request)
        days = int(request.query_params.get("days") or 30)
        start_dt = timezone.now() - datetime.timedelta(days=days)

        base_qs = StockMovement.objects.filter(
            created_at__gte=start_dt,
            reason__in=[StockMovement.SALE, StockMovement.RECEIVE, StockMovement.ADJUSTMENT],
        ).select_related("product", "product__category")

        if branch:
            base_qs = base_qs.filter(branch=branch)

        category_id = request.query_params.get("category")
        if category_id:
            base_qs = base_qs.filter(product__category_id=category_id)

        # Aggregate movement count and total quantity per product
        product_stats = {}
        for entry in (
            base_qs.values("product_id")
            .annotate(movement_count=Count("id"), total_qty=DbSum("quantity_delta"))
        ):
            product_stats[entry["product_id"]] = {
                "movement_count": entry["movement_count"],
                "total_qty": entry["total_qty"],
            }

        products_qs = Product.objects.filter(is_active=True)
        if branch:
            products_qs = products_qs.filter(branch=branch)
        if category_id:
            products_qs = products_qs.filter(category_id=category_id)
        products = list(
            products_qs.select_related("category").prefetch_related("stock_rows")
        )

        export_format = request.query_params.get("export")
        moving_data = []
        for product in products:
            stats = product_stats.get(product.id, {"movement_count": 0, "total_qty": 0})
            fast_qty = abs(stats["total_qty"]) if stats["total_qty"] else 0
            category_name = getattr(product.category, "name", "—")
            current_stock = (
                product.stock_rows.filter(branch=branch).first().quantity
                if branch else 0
            )
            moving_data.append({
                "product_id": product.id,
                "product_name": product.name,
                "sku": product.sku,
                "category": category_name,
                "movement_count": stats["movement_count"],
                "total_qty_in_out": fast_qty,
                "current_stock": current_stock,
                "movement_type": (
                    "fast" if stats["movement_count"] > 0 else "static"
                ),
            })

        counts = [d["movement_count"] for d in moving_data]
        avg_count = (sum(counts) / len(counts)) if counts else 0
        fast_items = sorted(
            [d for d in moving_data if d["movement_count"] >= avg_count and d["movement_count"] > 0],
            key=lambda x: x["movement_count"], reverse=True,
        )
        slow_items = sorted(
            [d for d in moving_data if d["movement_count"] < avg_count],
            key=lambda x: x["movement_count"],
        )

        if export_format == "csv":
            header = ["Product", "SKU", "Category", "Movement Count",
                      "Total Qty In/Out", "Current Stock", "Type"]
            csv_rows = [
                [d["product_name"], d["sku"], d["category"],
                 d["movement_count"], d["total_qty_in_out"],
                 d["current_stock"],
                 "Fast-moving" if d["movement_type"] == "fast" else "Slow/Static"]
                for d in moving_data
            ]
            return _csv_response("fast_slow_moving.csv", header, csv_rows)
        if export_format == "pdf":
            pdf_rows = [
                [d["product_name"], d["sku"], d["category"],
                 d["movement_count"], d["total_qty_in_out"]]
                for d in moving_data
            ]
            return _pdf_response("fast_slow_moving.pdf", "Fast/Slow Moving Report",
                               ["Product", "SKU", "Category", "Moves", "Qty"], pdf_rows)

        return Response({
            "period_days": days,
            "average_movement_per_product": round(avg_count, 2),
            "fast_moving": fast_items,
            "slow_moving": slow_items,
        })

    @action(detail=False, methods=["get"], url_path="monthly-variance")
    def monthly_variance(self, request):
        """Monthly stock variance report — per-product monthly closing stock."""
        branch = _resolve_read_branch(request)
        year = int(request.query_params.get("year") or timezone.now().year)
        month = request.query_params.get("month")

        export_format = request.query_params.get("export")

        products_qs = Product.objects.filter(is_active=True)
        if branch:
            products_qs = products_qs.filter(branch=branch)
        products = list(products_qs.select_related("category"))

        qs = InventoryStock.objects.select_related("product", "branch").filter(
            product__in=products,
        )
        if branch:
            qs = qs.filter(branch=branch)
        stock_map = {
            stock.product_id: stock.quantity
            for stock in qs
        }

        stocktake_qs = StocktakeSession.objects.filter(status=StocktakeSession.APPROVED)
        if branch:
            stocktake_qs = stocktake_qs.filter(branch=branch)
        if month:
            try:
                month_int = int(month)
            except ValueError:
                month_int = None
            if month_int:
                stocktake_qs = stocktake_qs.filter(
                    created_at__year=year, created_at__month=month_int,
                )
        else:
            stocktake_qs = stocktake_qs.filter(created_at__year=year)
        stocktake_qs = stocktake_qs.select_related("branch").prefetch_related("items__product")

        # Build snapshot: month -> product_id -> closing_stock
        monthly_snapshots = {}
        for session in stocktake_qs:
            for item in session.items.all():
                m = session.created_at.strftime("%Y-%m")
                monthly_snapshots.setdefault(m, {})[item.product_id] = item.counted_quantity

        # Sort months
        all_months = sorted(monthly_snapshots.keys())

        period = month or all_months[-1] if all_months else f"{year}-01"
        target_months = [period] if month else all_months

        reports = []
        for product in products:
            category_name = getattr(product.category, "name", "—")
            closing_qty = stock_map.get(product.id, 0)
            row = {
                "product_id": product.id,
                "product_name": product.name,
                "sku": product.sku,
                "category": category_name,
            }
            for m in target_months:
                snap = monthly_snapshots.get(m, {}).get(product.id)
                prev_m = _prev_month_str(m)
                prev_snap = monthly_snapshots.get(prev_m, {}).get(product.id)
                row[f"closing_stock_{m}"] = snap if snap is not None else closing_qty
            if len(target_months) == 2:
                c1 = row.get(f"closing_stock_{target_months[0]}", 0) or 0
                c2 = row.get(f"closing_stock_{target_months[1]}", 0) or 0
                row["variance"] = (c1 or 0) - (c2 or 0)
            elif len(target_months) == 1 and product.id in monthly_snapshots.get(target_months[0], {}):
                row["variance"] = 0
            else:
                row["variance"] = None
            reports.append(row)

        if export_format == "csv":
            if len(target_months) == 2:
                header = ["Product", "SKU", "Category",
                            f"Closing Stock {target_months[0]}",
                            f"Closing Stock {target_months[1]}",
                            "Variance"]
                csv_rows = [
                    [r["product_name"], r["sku"], r["category"],
                     r.get(f"closing_stock_{target_months[0]}", 0),
                     r.get(f"closing_stock_{target_months[1]}", 0),
                     r.get("variance") if r.get("variance") is not None else "—"]
                    for r in reports
                ]
            else:
                header = ["Product", "SKU", "Category", "Period", "Closing Stock", "Variance"]
                csv_rows = [
                    [r["product_name"], r["sku"], r["category"], target_months[0],
                     r.get(f"closing_stock_{target_months[0]}", 0),
                     r.get("variance") if r.get("variance") is not None else "—"]
                    for r in reports
                ]
            return _csv_response("monthly_variance.csv", header, csv_rows)
        if export_format == "pdf":
            pdf_rows = [
                [r["product_name"], r["sku"], r["category"],
                 r.get("variance") if r.get("variance") is not None else "—"]
                for r in reports
            ]
            return _pdf_response("monthly_variance.pdf", "Monthly Variance Report",
                                ["Product", "SKU", "Category", "Variance"], pdf_rows)

        return Response({
            "year": year,
            "months": target_months,
            "rows": reports,
            "monthly_snapshots_count": len(monthly_snapshots),
        })


# ---------------------------------------------------------------------------
# Customer
# ---------------------------------------------------------------------------

class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.select_related("branch__company")
    serializer_class = CustomerSerializer

    def get_queryset(self):
        queryset = _filter_branch_scoped_queryset(super().get_queryset(), self.request)
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(phone__icontains=search) | Q(email__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        serializer.save(branch=self._resolve_branch())

    def _resolve_branch(self):
        return _resolve_write_branch(self.request)


# ---------------------------------------------------------------------------
# Supplier
# ---------------------------------------------------------------------------

class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.select_related("branch__company")
    serializer_class = SupplierSerializer

    def get_queryset(self):
        queryset = _filter_branch_scoped_queryset(super().get_queryset(), self.request)
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(phone__icontains=search) | Q(email__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        serializer.save(branch=self._resolve_branch())

    def _resolve_branch(self):
        return _resolve_write_branch(self.request)


# ---------------------------------------------------------------------------
# Shift
# ---------------------------------------------------------------------------

class ShiftViewSet(viewsets.ModelViewSet):
    queryset = Shift.objects.select_related("branch__company", "register", "cashier")
    serializer_class = ShiftSerializer

    def get_queryset(self):
        queryset = _filter_branch_scoped_queryset(super().get_queryset(), self.request)

        branch_param = _positive_int_query_param(self.request.query_params, "branch")
        register = _positive_int_query_param(self.request.query_params, "register")
        cashier = _positive_int_query_param(self.request.query_params, "cashier")
        status_value = self.request.query_params.get("status")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if branch_param is not None:
            queryset = queryset.filter(branch_id=branch_param)
        if register is not None:
            queryset = queryset.filter(register_id=register)
        if cashier is not None:
            queryset = queryset.filter(cashier_id=cashier)
        if date_from:
            try:
                queryset = queryset.filter(opened_at__date__gte=datetime.date.fromisoformat(date_from))
            except ValueError as exc:
                raise ValidationError({"date_from": "Expected YYYY-MM-DD."}) from exc
        if date_to:
            try:
                queryset = queryset.filter(opened_at__date__lte=datetime.date.fromisoformat(date_to))
            except ValueError as exc:
                raise ValidationError({"date_to": "Expected YYYY-MM-DD."}) from exc
        if status_value:
            if status_value not in dict(Shift.STATUS_CHOICES):
                raise ValidationError({"status": "Expected one of: open, closed."})
            queryset = queryset.filter(status=status_value)
        return queryset

    @action(detail=False, methods=["get"], url_path="cash-management")
    def cash_management(self, request):
        return self.cashier_summary(request)

    @action(detail=False, methods=["get"], url_path="cashier-summary")
    def cashier_summary(self, request):
        from .sales_control import shift_cash_summary

        queryset = self.get_queryset().select_related("cashier", "register", "branch").order_by("-opened_at")
        search = (request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(cashier__username__icontains=search)
                | Q(cashier__first_name__icontains=search)
                | Q(cashier__last_name__icontains=search)
                | Q(register__code__icontains=search)
            )
        page = self.paginate_queryset(queryset)
        rows = [shift_cash_summary(shift) for shift in (page if page is not None else queryset)]
        if page is not None:
            return self.get_paginated_response(rows)
        return Response(rows)

    @action(detail=False, methods=["get"])
    def performance(self, request):
        shifts = self.get_queryset().select_related("cashier").order_by("-opened_at")
        rows = []
        for shift in shifts:
            sales = shift.sales.filter(status=Sale.PAID)
            agg = sales.aggregate(count=Count("id"), total=DbSum("total"))
            rows.append({
                **ShiftSerializer(shift).data,
                "sales_count": agg["count"] or 0,
                "sales_total": agg["total"] or 0,
            })
        return Response(rows)

    @action(detail=True, methods=["get"], url_path="cash-summary")
    def cash_summary(self, request, pk=None):
        from .sales_control import shift_cash_summary

        return Response(shift_cash_summary(self.get_object()))

    @action(detail=False, methods=["post"])
    def open(self, request):
        serializer = OpenShiftSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        register = serializer.validated_data["register"]
        existing_shift = Shift.objects.filter(register=register, status=Shift.OPEN).first()
        if existing_shift:
            return Response(ShiftSerializer(existing_shift).data, status=status.HTTP_200_OK)

        try:
            with transaction.atomic():
                shift = Shift.objects.create(
                    **serializer.validated_data,
                    expected_cash=serializer.validated_data["opening_cash"],
                )
        except IntegrityError:
            shift = Shift.objects.filter(register=register, status=Shift.OPEN).first()
            if not shift:
                raise
            return Response(ShiftSerializer(shift).data, status=status.HTTP_200_OK)

        return Response(ShiftSerializer(shift).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        serializer = CloseShiftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        shift = close_shift(
            shift=self.get_object(),
            counted_cash=serializer.validated_data["counted_cash"],
        )
        return Response(ShiftSerializer(shift).data)


# ---------------------------------------------------------------------------
# Sale
# ---------------------------------------------------------------------------

class SaleViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        Sale.objects
        .select_related("branch__company", "register", "shift", "cashier", "customer", "voided_by")
        .prefetch_related("items__product", "payments", "receipt_copies")
    )
    serializer_class = SaleSerializer

    def get_queryset(self):
        from .sales_control import apply_sales_filters

        queryset = _filter_branch_scoped_queryset(super().get_queryset(), self.request)
        return apply_sales_filters(queryset, self.request)

    @action(detail=False, methods=["get"])
    def control(self, request):
        from .sales_control import sales_control_dashboard

        sales_qs = self.get_queryset()
        branch = _resolve_read_branch(request)
        shift_qs = Shift.objects.filter(branch=branch) if branch else Shift.objects.none()
        return Response(sales_control_dashboard(sales_qs, shift_qs))

    @action(detail=False, methods=["get"])
    def transactions(self, request):
        queryset = self.filter_queryset(self.get_queryset().filter(status=Sale.PAID))
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def voids(self, request):
        queryset = self.filter_queryset(self.get_queryset().filter(status=Sale.VOIDED))
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def discounts(self, request):
        branch = _resolve_read_branch(request)
        if not branch:
            return Response([])
        items = (
            SaleItem.objects
            .filter(sale__branch=branch, discount_amount__gt=0)
            .select_related("sale", "sale__cashier", "product")
            .order_by("-sale__created_at")
        )
        search = (request.query_params.get("search") or "").strip()
        if search:
            items = items.filter(
                Q(sale__receipt_no__icontains=search) | Q(product__name__icontains=search)
            )
        rows = [
            {
                "receipt_no": item.sale.receipt_no,
                "sale_id": item.sale_id,
                "product_id": item.product_id,
                "product_name": item.product.name,
                "discount_amount": item.discount_amount,
                "line_total": item.line_total,
                "cashier_name": item.sale.cashier.get_username(),
                "created_at": item.sale.created_at,
            }
            for item in items[:200]
        ]
        return Response(rows)

    @action(detail=False, methods=["get"], url_path="customer-sales")
    def customer_sales(self, request):
        branch = _resolve_read_branch(request)
        if not branch:
            return Response([])
        sales = self.get_queryset().filter(status=Sale.PAID, customer__isnull=False)
        grouped = (
            sales.values("customer_id", "customer__name")
            .annotate(
                total_spent=DbSum("total"),
                receipt_count=Count("id"),
                last_purchase=Max("created_at"),
            )
            .order_by("-total_spent")
        )
        rows = []
        for row in grouped:
            credit_total = Payment.objects.filter(
                sale__branch=branch,
                sale__customer_id=row["customer_id"],
                sale__status=Sale.PAID,
                method=Payment.CREDIT,
            ).aggregate(total=DbSum("amount"))["total"] or 0
            rows.append({
                "customer_id": row["customer_id"],
                "customer_name": row["customer__name"],
                "total_spent": row["total_spent"] or 0,
                "receipt_count": row["receipt_count"] or 0,
                "last_purchase": row["last_purchase"],
                "credit_sales": credit_total,
            })
        return Response(rows)

    @action(detail=False, methods=["get"])
    def reports(self, request):
        from .sales_control import build_sales_report

        report_type = request.query_params.get("type", "daily_summary")
        return Response(build_sales_report(self.get_queryset(), report_type))

    @action(detail=False, methods=["post"])
    def checkout(self, request):
        serializer = CheckoutSerializer(data=request.data, context={"request": request})
        try:
            serializer.is_valid(raise_exception=True)
        except Exception as exc:
            # Log validation errors and payload when in debug to aid troubleshooting
            try:
                logger = logging.getLogger(__name__)
                if getattr(settings, 'DEBUG', False):
                    logger.error("Checkout validation failed: %s", getattr(serializer, 'errors', exc))
                    logger.error("Checkout payload: %s", request.data)
            except Exception:
                pass
            raise
        # If the client requested STK initiation, perform STK pushes first and
        # abort the checkout if any STK initiation fails. This prevents creating
        # the sale when STK is required but failed.
        validated = dict(serializer.validated_data)
        initiate_stk = validated.pop("initiate_stk", False)
        mpesa_checkout_request_id = (validated.pop("mpesa_checkout_request_id", "") or "").strip()
        mpesa_direct_transaction_id = (validated.pop("mpesa_direct_transaction_id", "") or "").strip().upper()
        mpesa_manual_approval = bool(validated.pop("mpesa_manual_approval", False))
        mpesa_payments = [payment for payment in validated.get("payments", []) if payment.get("method") == Payment.MPESA]

        paid_mpesa_log = None
        direct_mpesa_log = None
        if mpesa_payments:
            # Check whether this branch has M-Pesa credentials configured in DB.
            from .utils.mpesa import branch_has_mpesa_credentials
            branch_obj = validated.get("branch")
            branch_has_mpesa = branch_has_mpesa_credentials(branch_obj)

            if initiate_stk:
                raise ValidationError({"mpesa_stk": "Send STK first, wait for successful callback, then complete the sale."})

            mpesa_total = sum((payment.get("amount") for payment in mpesa_payments), Decimal("0.00"))
            if mpesa_direct_transaction_id:
                direct_mpesa_log = MpesaDirectPaymentLog.objects.filter(
                    branch=branch_obj,
                    transaction_id=mpesa_direct_transaction_id,
                    result_code=0,
                    success=True,
                    sale__isnull=True,
                ).order_by("-created_at").first()
                if not direct_mpesa_log:
                    raise ValidationError({"mpesa_direct": "Direct M-Pesa payment is not verified yet."})
                if direct_mpesa_log.amount is not None and direct_mpesa_log.amount != mpesa_total:
                    raise ValidationError({"mpesa_direct": "Verified M-Pesa amount does not match this sale."})
            # If the branch has branch-specific MPesa configured, require a successful STK callback before checkout.
            elif branch_has_mpesa:
                if not mpesa_checkout_request_id:
                    if mpesa_manual_approval:
                        if not getattr(branch_obj, "mpesa_manual_approval_enabled", False):
                            raise ValidationError({"mpesa_manual_approval": "Manual M-Pesa approval is not enabled for this branch."})
                        paid_mpesa_log = None
                    else:
                        raise ValidationError({"mpesa_stk": "M-Pesa sale requires a successful STK callback before checkout."})
                else:
                    paid_mpesa_log = MpesaStkLog.objects.filter(
                        branch=branch_obj,
                        checkout_request_id=mpesa_checkout_request_id,
                        result_code=0,
                        success=True,
                        sale__isnull=True,
                    ).order_by("-created_at").first()
                    if not paid_mpesa_log:
                        raise ValidationError({"mpesa_stk": "M-Pesa payment is not confirmed yet. Wait for callback success before completing sale."})

                    if paid_mpesa_log.amount != mpesa_total:
                        raise ValidationError({"mpesa_stk": "Confirmed M-Pesa amount does not match this sale."})
            else:
                # Branch does not have branch-specific M-Pesa configured; allow checkout without STK.
                paid_mpesa_log = None

        mpesa_stk_results = []
        if initiate_stk:
            from .utils.mpesa import initiate_stk_push
            from .models import Payment as _PaymentModel
            import re

            for p in validated.get("payments", []):
                if p.get("method") == _PaymentModel.MPESA:
                    ref = (p.get("reference") or "").split("|")[0].strip()
                    phone = re.sub(r"\D", "", ref)
                    if phone.startswith("0"):
                        phone = "254" + phone.lstrip("0")
                    result = initiate_stk_push(phone=phone, amount=p.get("amount"), reference=p.get("reference", ""), branch=validated.get("branch"))
                    mpesa_stk_results.append({"payment_reference": p.get("reference", ""), "result": result})

            # If any STK failed, abort and tell the client to retry without creating the sale
            failed = [r for r in mpesa_stk_results if not r["result"].get("success")]
            if failed:
                # Return a clear validation error with details for the frontend to show
                messages = [f"{r['payment_reference']}: {r['result'].get('message', 'STK failed')}" for r in failed]
                raise ValidationError({"mpesa_stk": "; ".join(messages)})

        # All required STK pushes succeeded (or were not requested) — create the sale
        sale = checkout_sale(**validated)
        if paid_mpesa_log:
            mpesa_payment = sale.payments.filter(method=Payment.MPESA).first()
            paid_mpesa_log.sale = sale
            paid_mpesa_log.payment = mpesa_payment
            paid_mpesa_log.save(update_fields=["sale", "payment", "updated_at"])
        if direct_mpesa_log:
            mpesa_payment = sale.payments.filter(method=Payment.MPESA).first()
            direct_mpesa_log.sale = sale
            direct_mpesa_log.payment = mpesa_payment
            direct_mpesa_log.save(update_fields=["sale", "payment", "updated_at"])
        response_data = SaleSerializer(sale).data
        if mpesa_stk_results:
            response_data["mpesa_stk_results"] = mpesa_stk_results
        return Response(response_data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="mpesa/stk-push")
    def mpesa_stk_push(self, request):
        serializer = MpesaStkPushSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        from .utils.mpesa import initiate_stk_push

        result = initiate_stk_push(
            phone=serializer.validated_data["phone"],
            amount=serializer.validated_data["amount"],
            reference=serializer.validated_data.get("reference", ""),
            description=serializer.validated_data.get("description", ""),
            branch=serializer.validated_data.get("branch"),
        )

        if not result.get("success"):
            raise ValidationError({"mpesa": result.get("message")})

        return Response(result)

    @action(detail=False, methods=["post"], url_path="mpesa/stk-query")
    def mpesa_stk_query(self, request):
        serializer = MpesaStkQuerySerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        from .utils.mpesa import query_stk_status

        result = query_stk_status(serializer.validated_data["checkout_request_id"], branch=serializer.validated_data.get("branch"))
        if not result.get("success"):
            raise ValidationError({"mpesa": result.get("message")})

        return Response(result)

    @action(detail=False, methods=["post"], url_path="mpesa/direct-lookup")
    def mpesa_direct_lookup(self, request):
        serializer = MpesaDirectLookupSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        from .utils.mpesa import initiate_direct_payment_lookup

        result = initiate_direct_payment_lookup(
            transaction_id=serializer.validated_data["transaction_id"],
            amount=serializer.validated_data.get("amount"),
            branch=serializer.validated_data.get("branch"),
        )
        if not result.get("success"):
            raise ValidationError({"mpesa": result.get("message")})

        return Response(result)

    @action(detail=True, methods=["post"])
    def void(self, request, pk=None):
        serializer = VoidSaleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sale = void_sale(
            sale=self.get_object(),
            user=serializer.validated_data["user"],
            reason=serializer.validated_data["reason"],
        )
        return Response(SaleSerializer(sale).data)

    @action(detail=True, methods=["post"], url_path="reprint")
    def reprint(self, request, pk=None):
        serializer = ReprintReceiptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        copy = reprint_receipt(
            sale=self.get_object(),
            user=serializer.validated_data.get("user"),
        )
        return Response(ReceiptCopySerializer(copy).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        sales = self.get_queryset().filter(status=Sale.PAID)
        total = sum((sale.total for sale in sales), 0)
        paid_count = sales.count()
        voided_count = self.get_queryset().filter(status=Sale.VOIDED).count()
        return Response({"paid_sales": paid_count, "voided_sales": voided_count, "total": total})


# ---------------------------------------------------------------------------
# Held Orders
# ---------------------------------------------------------------------------

class HeldOrderViewSet(viewsets.ModelViewSet):
    queryset = (
        HeldOrder.objects
        .select_related("branch__company", "register", "cashier", "customer")
        .prefetch_related("items__product")
    )
    serializer_class = HeldOrderSerializer

    def get_queryset(self):
        queryset = _filter_branch_scoped_queryset(super().get_queryset(), self.request)

        status_value = self.request.query_params.get("status")
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset

    @action(detail=False, methods=["post"])
    def hold(self, request):
        serializer = HoldOrderSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        items = serializer.validated_data.pop("items")
        with transaction.atomic():
            held_order = HeldOrder.objects.create(**serializer.validated_data)
            for item in items:
                HeldOrderItem.objects.create(held_order=held_order, **item)
        return Response(HeldOrderSerializer(held_order).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        held_order = self.get_object()
        held_order.status = HeldOrder.RESUMED
        held_order.save(update_fields=["status", "updated_at"])
        return Response(HeldOrderSerializer(held_order).data)

    @action(detail=True, methods=["put", "patch"], url_path="update-hold")
    def update_hold(self, request, pk=None):
        held_order = self.get_object()
        if held_order.status != HeldOrder.OPEN:
            raise ValidationError({"held_order": "Only open held orders can be updated."})
        serializer = UpdateHoldOrderSerializer(
            data=request.data, partial=True, context={"request": request, "held_order": held_order}
        )
        serializer.is_valid(raise_exception=True)
        items = serializer.validated_data.get("items")
        with transaction.atomic():
            if "customer" in serializer.validated_data:
                held_order.customer = serializer.validated_data["customer"]
            if "note" in serializer.validated_data:
                held_order.note = serializer.validated_data["note"]
            if items is not None:
                held_order.items.all().delete()
                for item in items:
                    HeldOrderItem.objects.create(held_order=held_order, **item)
            held_order.save()
        held_order = self.get_queryset().get(pk=held_order.pk)
        return Response(HeldOrderSerializer(held_order).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        held_order = self.get_object()
        held_order.status = HeldOrder.CANCELLED
        held_order.save(update_fields=["status", "updated_at"])
        return Response(HeldOrderSerializer(held_order).data)


# ---------------------------------------------------------------------------
# Stock Movement
# ---------------------------------------------------------------------------

class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StockMovement.objects.select_related("branch__company", "product", "user")
    serializer_class = StockMovementSerializer

    def get_queryset(self):
        return _filter_branch_scoped_queryset(super().get_queryset(), self.request)


# ---------------------------------------------------------------------------
# Audit Log
# ---------------------------------------------------------------------------

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("user", "branch__company")
    serializer_class = AuditLogSerializer

    def get_queryset(self):
        from .sales_control import _parse_iso_date

        queryset = _filter_branch_scoped_queryset(super().get_queryset(), self.request)
        action_value = self.request.query_params.get("action")
        entity = self.request.query_params.get("entity")
        user_id = _positive_int_query_param(self.request.query_params, "user")
        sales_only = self.request.query_params.get("sales_only")
        date_from = _parse_iso_date(self.request.query_params.get("date_from"), "date_from")
        date_to = _parse_iso_date(self.request.query_params.get("date_to"), "date_to")
        search = (self.request.query_params.get("search") or "").strip()

        if action_value:
            queryset = queryset.filter(action__icontains=action_value)
        if entity:
            queryset = queryset.filter(entity__iexact=entity)
        if user_id is not None:
            queryset = queryset.filter(user_id=user_id)
        if sales_only in {"1", "true", "yes"}:
            queryset = queryset.filter(
                Q(action__startswith="sale")
                | Q(action__startswith="sale_return")
                | Q(action__startswith="cash.")
                | Q(action__startswith="receipt.")
            )
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)
        if search:
            queryset = queryset.filter(
                Q(notes__icontains=search)
                | Q(entity__icontains=search)
                | Q(entity_id__icontains=search)
                | Q(user__username__icontains=search)
            )
        return queryset


# ---------------------------------------------------------------------------
# M-Pesa STK Logs
# ---------------------------------------------------------------------------


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def mpesa_callback(request):
    payload = request.data
    logger.info("M-Pesa callback received: %s", payload)

    callback = payload.get("Body", {}).get("stkCallback", {}) if isinstance(payload, dict) else {}
    checkout_request_id = callback.get("CheckoutRequestID") or ""
    merchant_request_id = callback.get("MerchantRequestID") or ""
    result_code = callback.get("ResultCode")
    result_desc = callback.get("ResultDesc") or ""
    try:
        result_code_value = int(result_code)
    except (TypeError, ValueError):
        result_code_value = None

    lookup = Q()
    queryset = MpesaStkLog.objects.none()
    if checkout_request_id or merchant_request_id:
        if checkout_request_id:
            lookup |= Q(checkout_request_id=checkout_request_id)
        if merchant_request_id:
            lookup |= Q(merchant_request_id=merchant_request_id)
        queryset = MpesaStkLog.objects.filter(lookup)

    updated = queryset.update(
        response=payload,
        result_code=result_code_value,
        result_desc=result_desc[:255],
        success=result_code_value == 0,
        message=result_desc[:255],
    )

    if updated == 0:
        logger.warning(
            "M-Pesa callback did not match any STK log. checkout_request_id=%s merchant_request_id=%s result_code=%s result_desc=%s",
            checkout_request_id,
            merchant_request_id,
            result_code,
            result_desc,
        )
        logger.warning("M-Pesa callback payload did not update a log: %s", payload)

    logger.info(
        "M-Pesa callback processed: checkout_request_id=%s merchant_request_id=%s result_code=%s updated_logs=%s",
        checkout_request_id,
        merchant_request_id,
        result_code,
        updated,
    )

    return Response({"ResultCode": 0, "ResultDesc": "Accepted"})


def _direct_result_parameter(result, *keys):
    parameters = (
        result
        .get("ResultParameters", {})
        .get("ResultParameter", [])
    )
    if isinstance(parameters, dict):
        parameters = [parameters]
    key_set = {key.lower() for key in keys}
    for item in parameters:
        key = str(item.get("Key", "")).lower()
        if key in key_set:
            return item.get("Value")
    return None


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def mpesa_direct_callback(request):
    payload = request.data
    logger.info("M-Pesa direct till callback received: %s", payload)

    result = payload.get("Result", {}) if isinstance(payload, dict) else {}
    originator_conversation_id = result.get("OriginatorConversationID") or ""
    conversation_id = result.get("ConversationID") or ""
    result_code = result.get("ResultCode")
    result_desc = result.get("ResultDesc") or ""
    try:
        result_code_value = int(result_code)
    except (TypeError, ValueError):
        result_code_value = None

    transaction_id = (
        _direct_result_parameter(result, "ReceiptNo", "TransactionID", "MpesaReceiptNumber")
        or ""
    )
    amount = _direct_result_parameter(result, "Amount", "TransactionAmount")
    phone = _direct_result_parameter(result, "PhoneNumber", "MSISDN")
    payer_name = _direct_result_parameter(result, "DebitPartyName", "CustomerName", "ReceiverPartyPublicName")

    lookup = Q()
    if originator_conversation_id:
        lookup |= Q(originator_conversation_id=originator_conversation_id)
    if conversation_id:
        lookup |= Q(conversation_id=conversation_id)
    if transaction_id:
        lookup |= Q(transaction_id=transaction_id)

    queryset = MpesaDirectPaymentLog.objects.filter(lookup) if lookup else MpesaDirectPaymentLog.objects.none()
    updates = {
        "response": payload,
        "result_code": result_code_value,
        "result_desc": result_desc[:255],
        "success": result_code_value == 0,
        "message": result_desc[:255],
        "originator_conversation_id": originator_conversation_id,
        "conversation_id": conversation_id,
    }
    if transaction_id:
        updates["transaction_id"] = transaction_id
    if amount not in (None, ""):
        try:
            updates["amount"] = Decimal(str(amount))
        except Exception:
            logger.warning("M-Pesa direct callback had invalid amount: %s", amount)
    if phone:
        updates["phone"] = str(phone)
    if payer_name:
        updates["payer_name"] = str(payer_name)[:160]

    updated = queryset.update(**updates)
    if updated == 0:
        logger.warning(
            "M-Pesa direct callback did not match any log. originator=%s conversation=%s transaction=%s result_code=%s",
            originator_conversation_id,
            conversation_id,
            transaction_id,
            result_code,
        )

    return Response({"ResultCode": 0, "ResultDesc": "Accepted"})


class MpesaStkLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MpesaStkLog.objects.select_related('branch__company', 'sale', 'payment')
    serializer_class = MpesaStkLogSerializer

    def get_queryset(self):
        queryset = super().get_queryset().order_by('-created_at')
        branch_obj = _resolve_read_branch(self.request)
        phone = (self.request.query_params.get('phone') or '').strip()
        success = self.request.query_params.get('success')
        checkout_request_id = (self.request.query_params.get('checkout_request_id') or '').strip()
        merchant_request_id = (self.request.query_params.get('merchant_request_id') or '').strip()

        if not branch_obj:
            return queryset.none()
        queryset = queryset.filter(
            Q(branch=branch_obj) |
            Q(sale__branch=branch_obj) |
            Q(payment__sale__branch=branch_obj)
        )
        if phone:
            queryset = queryset.filter(phone__icontains=phone)
        if checkout_request_id:
            queryset = queryset.filter(checkout_request_id=checkout_request_id)
        if merchant_request_id:
            queryset = queryset.filter(merchant_request_id=merchant_request_id)
        if success in {'1', 'true', 'yes'}:
            queryset = queryset.filter(success=True)
        if success in {'0', 'false', 'no'}:
            queryset = queryset.filter(success=False)
        return queryset


class MpesaDirectPaymentLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MpesaDirectPaymentLog.objects.select_related('branch__company', 'sale', 'payment')
    serializer_class = MpesaDirectPaymentLogSerializer

    def get_queryset(self):
        queryset = super().get_queryset().order_by('-created_at')
        branch_obj = _resolve_read_branch(self.request)
        if not branch_obj:
            return queryset.none()
        queryset = queryset.filter(
            Q(branch=branch_obj) |
            Q(sale__branch=branch_obj) |
            Q(payment__sale__branch=branch_obj)
        )
        transaction_id = (self.request.query_params.get('transaction_id') or '').strip().upper()
        conversation_id = (self.request.query_params.get('conversation_id') or '').strip()
        success = self.request.query_params.get('success')
        if transaction_id:
            queryset = queryset.filter(transaction_id=transaction_id)
        if conversation_id:
            queryset = queryset.filter(Q(conversation_id=conversation_id) | Q(originator_conversation_id=conversation_id))
        if success in {'1', 'true', 'yes'}:
            queryset = queryset.filter(success=True)
        if success in {'0', 'false', 'no'}:
            queryset = queryset.filter(success=False)
        return queryset


# ---------------------------------------------------------------------------
# Purchase Order
# ---------------------------------------------------------------------------

class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = (
        PurchaseOrder.objects
        .select_related("branch__company", "created_by")
        .prefetch_related("items__product")
    )
    serializer_class = PurchaseOrderSerializer

    def get_queryset(self):
        queryset = _filter_branch_scoped_queryset(super().get_queryset(), self.request)

        status_value = self.request.query_params.get("status")
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset

    @action(detail=False, methods=["post"])
    def create_order(self, request):
        serializer = CreatePurchaseOrderSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        po = create_purchase_order(**serializer.validated_data)
        return Response(PurchaseOrderSerializer(po).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def receive(self, request, pk=None):
        serializer = ReceivePurchaseOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        po = receive_purchase_order(
            purchase_order=self.get_object(), **serializer.validated_data
        )
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        po = self.get_object()
        if po.status in [PurchaseOrder.RECEIVED, PurchaseOrder.PARTIAL]:
            raise ValidationError({"purchase_order": "Received or partially-received orders cannot be cancelled."})
        cancelled_po = cancel_purchase_order(purchase_order=po, user=request.user)
        return Response(PurchaseOrderSerializer(cancelled_po).data)

    @action(detail=True, methods=["post"])
    def update_order(self, request, pk=None):
        serializer = UpdatePurchaseOrderSerializer(data=request.data, instance=self.get_object(), context={"request": request})
        serializer.is_valid(raise_exception=True)
        po = update_purchase_order(
            purchase_order=self.get_object(),
            **serializer.validated_data,
            user=request.user,
        )
        return Response(PurchaseOrderSerializer(po).data, status=status.HTTP_200_OK)

    _EDITABLE_STATUSES = {PurchaseOrder.DRAFT, PurchaseOrder.ORDERED}

    def perform_update(self, serializer):
        po = serializer.instance
        if po.status not in self._EDITABLE_STATUSES:
            raise ValidationError({"purchase_order": "Only draft or ordered purchase orders can be edited."})
        serializer.save()

    def perform_destroy(self, instance):
        if instance.status not in self._EDITABLE_STATUSES:
            raise ValidationError({"purchase_order": "Only draft or ordered purchase orders can be deleted."})
        instance.delete()


# ---------------------------------------------------------------------------
# Stocktake
# ---------------------------------------------------------------------------

class StocktakeViewSet(viewsets.ModelViewSet):
    queryset = (
        StocktakeSession.objects
        .select_related("branch__company", "created_by", "approved_by")
        .prefetch_related("items__product")
    )
    serializer_class = StocktakeSessionSerializer

    def get_queryset(self):
        return _filter_branch_scoped_queryset(super().get_queryset(), self.request)

    @action(detail=False, methods=["post"])
    def start(self, request):
        serializer = CreateStocktakeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        session = create_stocktake(**serializer.validated_data)
        return Response(StocktakeSessionSerializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def count(self, request, pk=None):
        serializer = CountStocktakeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = count_stocktake(stocktake=self.get_object(), **serializer.validated_data)
        return Response(StocktakeSessionSerializer(session).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        serializer = ApproveStocktakeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = approve_stocktake(stocktake=self.get_object(), **serializer.validated_data)
        return Response(StocktakeSessionSerializer(session).data)
