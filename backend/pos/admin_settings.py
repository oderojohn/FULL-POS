from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Company, CompanySettings, default_company_settings
from .permissions import get_pos_profile, profile_company
from .rbac import (
    ADMIN_SECTION_PERMISSIONS,
    PERMISSION_CATALOG,
    can_access_admin_section,
    has_permission,
    permissions_for_profile,
    role_permission_matrix,
)
from .serializers import CompanySettingsSerializer
from .views import _positive_int_query_param, is_company_admin, is_super_admin


def _resolve_settings_company(request):
    company_id = _positive_int_query_param(request.query_params, "company")
    if company_id is not None:
        company = Company.objects.filter(pk=company_id, is_active=True).first()
        if not company:
            raise ValidationError({"company": "Company not found."})
    else:
        profile = get_pos_profile(request.user)
        company = profile.company if profile else None
        if not company and profile and profile.branch_id:
            company = profile.branch.company
    if not company:
        raise ValidationError({"company": "Company context is required."})
    if not is_super_admin(request.user):
        user_company = profile_company(get_pos_profile(request.user))
        if not user_company or company.id != user_company.id:
            raise PermissionDenied("You do not have access to this company's settings.")
    return company


def get_or_create_company_settings(company):
    settings, created = CompanySettings.objects.get_or_create(
        company=company,
        defaults=default_company_settings(),
    )
    return settings


class CompanySettingsViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _ensure_can_edit(self, request):
        perms = permissions_for_profile(get_pos_profile(request.user))
        if not has_permission(perms, "admin.settings") and not has_permission(perms, "*"):
            raise PermissionDenied("You do not have permission to change settings.")

    def list(self, request):
        company = _resolve_settings_company(request)
        settings = get_or_create_company_settings(company)
        return Response(CompanySettingsSerializer(settings).data)

    def partial_update(self, request, pk=None):
        self._ensure_can_edit(request)
        company = _resolve_settings_company(request)
        settings = get_or_create_company_settings(company)
        serializer = CompanySettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CompanySettingsSerializer(settings).data)

    @action(detail=False, methods=["get"], url_path="by-company")
    def by_company(self, request):
        company = _resolve_settings_company(request)
        settings = get_or_create_company_settings(company)
        return Response(CompanySettingsSerializer(settings).data)

    @action(detail=False, methods=["patch"], url_path="update-section")
    def update_section(self, request):
        self._ensure_can_edit(request)
        section = request.data.get("section")
        values = request.data.get("values")
        if not section or values is None:
            raise ValidationError({"detail": "section and values are required."})
        allowed = set(default_company_settings().keys())
        if section not in allowed:
            raise ValidationError({"section": f"Expected one of: {', '.join(sorted(allowed))}"})
        company = _resolve_settings_company(request)
        settings = get_or_create_company_settings(company)
        current = getattr(settings, section) or {}
        if not isinstance(values, dict):
            raise ValidationError({"values": "Must be an object."})
        merged = {**current, **values}
        setattr(settings, section, merged)
        settings.save(update_fields=[section, "updated_at"])
        return Response(CompanySettingsSerializer(settings).data)


class AdminRbacViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=["get"], url_path="catalog")
    def catalog(self, request):
        profile = get_pos_profile(request.user)
        effective = permissions_for_profile(profile)
        return Response({
            "permissions": effective,
            "catalog": [
                {"code": code, **meta}
                for code, meta in PERMISSION_CATALOG.items()
            ],
            "admin_sections": ADMIN_SECTION_PERMISSIONS,
            "role_matrix": role_permission_matrix(),
        })

    @action(detail=False, methods=["get"], url_path="my-access")
    def my_access(self, request):
        profile = get_pos_profile(request.user)
        perms = permissions_for_profile(profile)
        sections = {
            name: can_access_admin_section(perms, name)
            for name in ADMIN_SECTION_PERMISSIONS
        }
        return Response({
            "role": profile.role if profile else None,
            "access_level": profile.access_level if profile else None,
            "permissions": perms,
            "admin_sections": sections,
        })
