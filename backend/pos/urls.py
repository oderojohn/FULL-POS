from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .admin_settings import AdminRbacViewSet, CompanySettingsViewSet
from .sales_control import CashTransactionViewSet, PaymentViewSet, SaleReturnViewSet
from .views import (
    AuditLogViewSet,
    AuthViewSet,
    BranchViewSet,
    CategoryViewSet,
    CompanyViewSet,
    CustomerViewSet,
    HeldOrderViewSet,
    InventoryStockViewSet,
    ProductViewSet,
    PurchaseOrderViewSet,
    RegisterViewSet,
    SaleViewSet,
    ShiftViewSet,
    StockMovementViewSet,
    StocktakeViewSet,
    UserProfileViewSet,
    MpesaDirectPaymentLogViewSet,
    MpesaStkLogViewSet,
    mpesa_callback,
    mpesa_direct_callback,
)


router = DefaultRouter()
router.register("admin-settings", CompanySettingsViewSet, basename="admin-settings")
router.register("admin-rbac", AdminRbacViewSet, basename="admin-rbac")
router.register("auth", AuthViewSet, basename="auth")
router.register("users", UserProfileViewSet)
router.register("companies", CompanyViewSet)
router.register("branches", BranchViewSet)
router.register("registers", RegisterViewSet)
router.register("categories", CategoryViewSet)
router.register("products", ProductViewSet)
router.register("stock", InventoryStockViewSet)
router.register("customers", CustomerViewSet)
router.register("shifts", ShiftViewSet)
router.register("sales", SaleViewSet)
router.register("sale-returns", SaleReturnViewSet, basename="sale-returns")
router.register("payments", PaymentViewSet, basename="payments")
router.register("cash-transactions", CashTransactionViewSet, basename="cash-transactions")
router.register("held-orders", HeldOrderViewSet)
router.register("stock-movements", StockMovementViewSet)
router.register("audit-logs", AuditLogViewSet)
router.register("purchase-orders", PurchaseOrderViewSet)
router.register("stocktakes", StocktakeViewSet)
router.register("mpesa-stk-logs", MpesaStkLogViewSet, basename="mpesa-stk-logs")
router.register("mpesa-direct-logs", MpesaDirectPaymentLogViewSet, basename="mpesa-direct-logs")

urlpatterns = [
    path("mpesa/callback", mpesa_callback, name="mpesa-callback"),
    path("mpesa/callback/", mpesa_callback, name="mpesa-callback-slash"),
    path("mpesa/direct-callback", mpesa_direct_callback, name="mpesa-direct-callback"),
    path("mpesa/direct-callback/", mpesa_direct_callback, name="mpesa-direct-callback-slash"),
    path("", include(router.urls)),
]
