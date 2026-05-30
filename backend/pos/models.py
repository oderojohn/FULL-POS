from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Company(TimeStampedModel):
    name = models.CharField(max_length=160)
    currency = models.CharField(max_length=10, default="KES")
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Companies"

    def __str__(self):
        return self.name


def default_company_settings():
    return {
        "security": {
            "pin_login_enabled": True,
            "two_factor_optional": True,
            "auto_logout_minutes": 15,
            "device_history": True,
            "force_logout_admin_only": True,
        },
        "system": {
            "tax_mode": "inclusive",
            "receipt_prefix": "RC",
            "invoice_prefix": "INV",
            "return_prefix": "RET",
            "printer_type": "thermal_80mm",
        },
        "pos_operations": {
            "discounts_enabled": True,
            "refunds_manager_approval": True,
            "credit_sales_enabled": True,
            "layby_enabled": False,
            "barcode_mode": True,
            "max_cashier_discount_pct": 5,
        },
        "stock_controls": {
            "auto_deduct_on_sale": True,
            "branch_stock_separation": True,
            "transfer_approval_required": True,
            "low_stock_alerts": True,
            "stock_adjustment_approval": True,
        },
        "notifications": {
            "low_stock": {"sms": False, "email": True, "whatsapp": False, "recipients": "inventory"},
            "daily_sales": {"sms": False, "email": True, "whatsapp": False, "recipients": "managers"},
            "refund_alerts": {"sms": True, "email": True, "whatsapp": False, "recipients": "managers"},
            "suspicious_activity": {"sms": False, "email": True, "whatsapp": True, "recipients": "admins"},
        },
        "financial": {
            "daily_cash_summaries": True,
            "cash_drawer_tracking": True,
            "z_report_required": True,
            "cash_discrepancy_tracking": True,
            "payment_methods": "cash,mpesa,card",
        },
        "pricing": {
            "retail_price_edits": "manager",
            "wholesale_price_edits": "admin",
            "max_cashier_discount_pct": 5,
            "product_deactivation": "admin",
            "price_change_workflow": True,
        },
        "backup": {
            "auto_backup_enabled": True,
            "auto_backup_time": "01:00",
            "manual_download": True,
            "restore_admin_only": True,
            "csv_export": True,
            "archive_months": 24,
        },
        "integrations": {
            "mpesa": {"status": "connected", "mode": "live", "notes": "Callbacks enabled"},
            "thermal_printers": {"status": "ready", "mode": "usb_network", "notes": "80mm default"},
            "barcode_scanners": {"status": "supported", "mode": "keyboard_wedge", "notes": "Plug and play"},
            "accounting": {"status": "optional", "mode": "api", "notes": "Export journal entries"},
            "api_keys": {"status": "managed", "mode": "admin_only", "notes": "Rotate every 90 days"},
        },
        "super_admin": {
            "manage_all_businesses": True,
            "suspend_companies": True,
            "view_all_transactions": True,
            "force_logout_users": True,
            "maintenance_mode": False,
        },
    }


class CompanySettings(TimeStampedModel):
    company = models.OneToOneField(Company, related_name="settings", on_delete=models.CASCADE)
    security = models.JSONField(default=dict, blank=True)
    system = models.JSONField(default=dict, blank=True)
    pos_operations = models.JSONField(default=dict, blank=True)
    stock_controls = models.JSONField(default=dict, blank=True)
    notifications = models.JSONField(default=dict, blank=True)
    financial = models.JSONField(default=dict, blank=True)
    pricing = models.JSONField(default=dict, blank=True)
    backup = models.JSONField(default=dict, blank=True)
    integrations = models.JSONField(default=dict, blank=True)
    super_admin = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name_plural = "Company settings"

    def merged_settings(self):
        defaults = default_company_settings()
        return {
            "security": {**defaults["security"], **(self.security or {})},
            "system": {**defaults["system"], **(self.system or {})},
            "pos_operations": {**defaults["pos_operations"], **(self.pos_operations or {})},
            "stock_controls": {**defaults["stock_controls"], **(self.stock_controls or {})},
            "notifications": {**defaults["notifications"], **(self.notifications or {})},
            "financial": {**defaults["financial"], **(self.financial or {})},
            "pricing": {**defaults["pricing"], **(self.pricing or {})},
            "backup": {**defaults["backup"], **(self.backup or {})},
            "integrations": {**defaults["integrations"], **(self.integrations or {})},
            "super_admin": {**defaults["super_admin"], **(self.super_admin or {})},
        }


class Branch(TimeStampedModel):
    ENVIRONMENT_CHOICES = [
        ("sandbox", "Sandbox"),
        ("live", "Live"),
    ]

    company = models.ForeignKey(Company, related_name="branches", on_delete=models.CASCADE)
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=120)
    location = models.CharField(max_length=160, blank=True)
    is_active = models.BooleanField(default=True)
    mpesa_stk_enabled = models.BooleanField(default=False)
    mpesa_manual_approval_enabled = models.BooleanField(default=False)
    mpesa_till_enabled = models.BooleanField(default=False)
    mpesa_consumer_key = models.CharField(max_length=255, blank=True)
    mpesa_consumer_secret = models.CharField(max_length=255, blank=True)
    mpesa_business_shortcode = models.CharField(max_length=64, blank=True)
    mpesa_passkey = models.CharField(max_length=255, blank=True)
    mpesa_environment = models.CharField(max_length=16, choices=ENVIRONMENT_CHOICES, default="sandbox", blank=True)
    mpesa_callback_url = models.CharField(max_length=255, blank=True)
    mpesa_till_number = models.CharField(max_length=64, blank=True)
    mpesa_initiator_name = models.CharField(max_length=120, blank=True)
    mpesa_security_credential = models.CharField(max_length=1024, blank=True)
    mpesa_direct_result_url = models.CharField(max_length=255, blank=True)
    mpesa_direct_timeout_url = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.company_id:
            self.company, _ = Company.objects.get_or_create(
                name="Demo Company",
                defaults={"currency": "KES", "vat_rate": 16},
            )
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.company.name} — {self.name}"


class UserProfile(TimeStampedModel):
    CASHIER = "cashier"
    MANAGER = "manager"
    INVENTORY = "inventory"
    ADMIN = "admin"
    ROLE_CHOICES = [
        (CASHIER, "Cashier"),
        (MANAGER, "Manager"),
        (INVENTORY, "Inventory Officer"),
        (ADMIN, "Administrator"),
    ]

    # Access level - determines scope of access
    SUPER_ADMIN = "super_admin"
    COMPANY_ADMIN = "company_admin"
    BRANCH_ADMIN = "branch_admin"
    BRANCH_STAFF = "branch_staff"
    ACCESS_LEVEL_CHOICES = [
        (SUPER_ADMIN, "Super Admin"),
        (COMPANY_ADMIN, "Company Admin"),
        (BRANCH_ADMIN, "Branch Admin"),
        (BRANCH_STAFF, "Branch Staff"),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, related_name="pos_profile", on_delete=models.CASCADE
    )
    pin = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=30, choices=ROLE_CHOICES, default=CASHIER)
    access_level = models.CharField(
        max_length=30, choices=ACCESS_LEVEL_CHOICES, default=BRANCH_STAFF
    )
    branch = models.ForeignKey(
        Branch, null=True, blank=True,
        related_name="staff_profiles", on_delete=models.SET_NULL,
    )
    company = models.ForeignKey(
        Company, null=True, blank=True,
        related_name="staff_profiles", on_delete=models.SET_NULL,
    )
    custom_permissions = models.JSONField(default=list, blank=True)
    use_custom_permissions = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.user} ({self.role}) - {self.get_access_level_display()}"


class Register(TimeStampedModel):
    branch = models.ForeignKey(Branch, related_name="registers", on_delete=models.PROTECT)
    code = models.CharField(max_length=30)
    name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["branch", "code"], name="unique_register_per_branch"),
        ]

    def __str__(self):
        return f"{self.branch.code}-{self.code}"


class Category(TimeStampedModel):
    """
    Scoped to a branch. Company is always derivable via category.branch.company.
    Each branch manages its own category list independently.
    """
    branch = models.ForeignKey(Branch, related_name="categories", on_delete=models.CASCADE)
    name = models.CharField(max_length=120)
    color = models.CharField(max_length=40, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["branch", "name"], name="unique_category_per_branch"),
        ]

    def __str__(self):
        return self.name


class Product(TimeStampedModel):
    """
    Scoped to a branch. Stock levels are tracked via InventoryStock on the same branch.
    Company is always derivable via product.branch.company.
    """
    branch = models.ForeignKey(Branch, related_name="products", on_delete=models.CASCADE)
    category = models.ForeignKey(Category, related_name="products", on_delete=models.PROTECT)
    name = models.CharField(max_length=180)
    sku = models.CharField(max_length=60)
    barcode = models.CharField(max_length=80, blank=True, db_index=True)
    retail_price = models.DecimalField(max_digits=12, decimal_places=2)
    wholesale_price = models.DecimalField(max_digits=12, decimal_places=2)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    reorder_point = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["sku"]),
            models.Index(fields=["barcode"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["branch", "sku"], name="unique_sku_per_branch"),
        ]

    def __str__(self):
        return self.name


class InventoryStock(TimeStampedModel):
    branch = models.ForeignKey(Branch, related_name="inventory", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, related_name="stock_rows", on_delete=models.CASCADE)
    quantity = models.IntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["branch", "product"], name="unique_product_stock_per_branch"),
            models.CheckConstraint(check=models.Q(quantity__gte=0), name="stock_quantity_cannot_be_negative"),
        ]

    def __str__(self):
        return f"{self.branch.code} {self.product.sku}: {self.quantity}"


class StockMovement(TimeStampedModel):
    SALE = "sale"
    VOID = "void"
    RETURN = "return"
    ADJUSTMENT = "adjustment"
    RECEIVE = "receive"
    HOLD_RELEASE = "hold_release"
    REASON_CHOICES = [
        (SALE, "Sale"),
        (VOID, "Void"),
        (RETURN, "Return"),
        (ADJUSTMENT, "Adjustment"),
        (RECEIVE, "Receive"),
        (HOLD_RELEASE, "Hold Release"),
    ]

    branch = models.ForeignKey(Branch, related_name="stock_movements", on_delete=models.PROTECT)
    product = models.ForeignKey(Product, related_name="stock_movements", on_delete=models.PROTECT)
    quantity_delta = models.IntegerField()
    reason = models.CharField(max_length=30, choices=REASON_CHOICES)
    reference = models.CharField(max_length=80, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )

    class Meta:
        ordering = ["-created_at"]


class AuditLog(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    action = models.CharField(max_length=80)
    entity = models.CharField(max_length=80, blank=True)
    entity_id = models.CharField(max_length=80, blank=True)
    branch = models.ForeignKey(Branch, null=True, blank=True, on_delete=models.SET_NULL)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]


class Customer(TimeStampedModel):
    """
    Scoped to a branch. Company is derivable via customer.branch.company.
    """
    branch = models.ForeignKey(Branch, related_name="customers", on_delete=models.CASCADE)
    name = models.CharField(max_length=160)
    phone = models.CharField(max_length=40, blank=True, db_index=True)
    email = models.EmailField(blank=True)
    tax_pin = models.CharField(max_length=40, blank=True)
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Supplier(TimeStampedModel):
    """
    Scoped to a branch. Company is derivable via supplier.branch.company.
    """
    branch = models.ForeignKey(Branch, related_name="suppliers", on_delete=models.CASCADE)
    name = models.CharField(max_length=160)
    contact_person = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=40, blank=True, db_index=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=240, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["branch", "name"], name="unique_supplier_per_branch"),
        ]

    def __str__(self):
        return self.name


class Shift(TimeStampedModel):
    OPEN = "open"
    CLOSED = "closed"
    STATUS_CHOICES = [(OPEN, "Open"), (CLOSED, "Closed")]

    branch = models.ForeignKey(Branch, related_name="shifts", on_delete=models.PROTECT)
    register = models.ForeignKey(Register, related_name="shifts", on_delete=models.PROTECT)
    cashier = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="pos_shifts", on_delete=models.PROTECT
    )
    opened_at = models.DateTimeField(default=timezone.now)
    closed_at = models.DateTimeField(null=True, blank=True)
    opening_cash = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    expected_cash = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    counted_cash = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    cash_variance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=OPEN)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["register"],
                condition=models.Q(status="open"),
                name="one_open_shift_per_register",
            ),
        ]
        ordering = ["-opened_at"]

    def __str__(self):
        return f"{self.register} {self.cashier} {self.status}"


class HeldOrder(TimeStampedModel):
    OPEN = "open"
    RESUMED = "resumed"
    CANCELLED = "cancelled"
    STATUS_CHOICES = [(OPEN, "Open"), (RESUMED, "Resumed"), (CANCELLED, "Cancelled")]

    branch = models.ForeignKey(Branch, related_name="held_orders", on_delete=models.PROTECT)
    register = models.ForeignKey(Register, related_name="held_orders", on_delete=models.PROTECT)
    cashier = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="held_orders", on_delete=models.PROTECT
    )
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.SET_NULL)
    note = models.CharField(max_length=240, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=OPEN)

    class Meta:
        ordering = ["-created_at"]


class HeldOrderItem(models.Model):
    held_order = models.ForeignKey(HeldOrder, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)

    @property
    def line_total(self):
        return self.quantity * self.unit_price


class Sale(TimeStampedModel):
    RETAIL = "retail"
    WHOLESALE = "wholesale"
    MODE_CHOICES = [(RETAIL, "Retail"), (WHOLESALE, "Wholesale")]

    DRAFT = "draft"
    PAID = "paid"
    VOIDED = "voided"
    STATUS_CHOICES = [(DRAFT, "Draft"), (PAID, "Paid"), (VOIDED, "Voided")]

    receipt_no = models.CharField(max_length=40, unique=True)
    branch = models.ForeignKey(Branch, related_name="sales", on_delete=models.PROTECT)
    register = models.ForeignKey(Register, related_name="sales", on_delete=models.PROTECT)
    shift = models.ForeignKey(Shift, related_name="sales", on_delete=models.PROTECT)
    cashier = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="sales", on_delete=models.PROTECT
    )
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.SET_NULL)
    mode = models.CharField(max_length=20, choices=MODE_CHOICES, default=RETAIL)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tax_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    paid_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    change_due = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=DRAFT)
    voided_at = models.DateTimeField(null=True, blank=True)
    voided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        related_name="voided_sales", on_delete=models.SET_NULL,
    )
    void_reason = models.CharField(max_length=240, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["receipt_no"]),
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self):
        return self.receipt_no


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    line_total = models.DecimalField(max_digits=12, decimal_places=2)


class Payment(models.Model):
    CASH = "cash"
    CARD = "card"
    MPESA = "mpesa"
    CREDIT = "credit"
    METHOD_CHOICES = [(CASH, "Cash"), (CARD, "Card"), (MPESA, "M-Pesa"), (CREDIT, "Credit")]

    sale = models.ForeignKey(Sale, related_name="payments", on_delete=models.CASCADE)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class MpesaStkLog(TimeStampedModel):
    branch = models.ForeignKey('Branch', related_name='mpesa_stk_logs', null=True, blank=True, on_delete=models.SET_NULL)
    sale = models.ForeignKey('Sale', related_name='mpesa_stk_logs', null=True, blank=True, on_delete=models.SET_NULL)
    payment = models.ForeignKey('Payment', related_name='mpesa_stk_logs', null=True, blank=True, on_delete=models.SET_NULL)
    phone = models.CharField(max_length=40)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=120, blank=True)
    request = models.JSONField(default=dict, blank=True)
    response = models.JSONField(default=dict, blank=True)
    success = models.BooleanField(default=False)
    message = models.CharField(max_length=255, blank=True)
    merchant_request_id = models.CharField(max_length=120, blank=True)
    checkout_request_id = models.CharField(max_length=120, blank=True)
    result_code = models.IntegerField(null=True, blank=True)
    result_desc = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"MPESA STK {self.phone} {self.amount} {'OK' if self.success else 'FAIL'}"


class MpesaDirectPaymentLog(TimeStampedModel):
    branch = models.ForeignKey('Branch', related_name='mpesa_direct_logs', null=True, blank=True, on_delete=models.SET_NULL)
    sale = models.ForeignKey('Sale', related_name='mpesa_direct_logs', null=True, blank=True, on_delete=models.SET_NULL)
    payment = models.ForeignKey('Payment', related_name='mpesa_direct_logs', null=True, blank=True, on_delete=models.SET_NULL)
    transaction_id = models.CharField(max_length=120, db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    payer_name = models.CharField(max_length=160, blank=True)
    request = models.JSONField(default=dict, blank=True)
    response = models.JSONField(default=dict, blank=True)
    success = models.BooleanField(default=False)
    message = models.CharField(max_length=255, blank=True)
    originator_conversation_id = models.CharField(max_length=120, blank=True, db_index=True)
    conversation_id = models.CharField(max_length=120, blank=True, db_index=True)
    result_code = models.IntegerField(null=True, blank=True)
    result_desc = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"MPESA Direct {self.transaction_id} {'OK' if self.success else 'PENDING'}"


class ReceiptCopy(TimeStampedModel):
    sale = models.ForeignKey(Sale, related_name="receipt_copies", on_delete=models.CASCADE)
    printed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    copy_no = models.PositiveIntegerField(default=1)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["sale", "copy_no"], name="unique_receipt_copy_no"),
        ]


class SaleReturn(TimeStampedModel):
    PENDING = "pending"
    APPROVED = "approved"
    COMPLETED = "completed"
    REJECTED = "rejected"
    STATUS_CHOICES = [
        (PENDING, "Pending"),
        (APPROVED, "Approved"),
        (COMPLETED, "Completed"),
        (REJECTED, "Rejected"),
    ]

    return_no = models.CharField(max_length=40, unique=True)
    sale = models.ForeignKey(Sale, related_name="returns", on_delete=models.PROTECT)
    branch = models.ForeignKey(Branch, related_name="sale_returns", on_delete=models.PROTECT)
    shift = models.ForeignKey(
        Shift, null=True, blank=True, related_name="sale_returns", on_delete=models.SET_NULL
    )
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="processed_returns", on_delete=models.PROTECT
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        related_name="approved_returns", on_delete=models.SET_NULL,
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING)
    reason = models.CharField(max_length=240)
    rejection_reason = models.CharField(max_length=240, blank=True)
    refund_method = models.CharField(max_length=20, choices=Payment.METHOD_CHOICES, default=Payment.CASH)
    subtotal_refund = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tax_refund = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total_refund = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    approved_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["return_no"]),
        ]

    def __str__(self):
        return self.return_no


class SaleReturnItem(models.Model):
    sale_return = models.ForeignKey(SaleReturn, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    line_refund = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["sale_return", "product"], name="unique_product_per_return"),
        ]


class CashTransaction(TimeStampedModel):
    CASH_IN = "cash_in"
    CASH_OUT = "cash_out"
    PAYOUT = "payout"
    DROP = "drop"
    TYPE_CHOICES = [
        (CASH_IN, "Cash In"),
        (CASH_OUT, "Cash Out"),
        (PAYOUT, "Payout"),
        (DROP, "Cash Drop"),
    ]

    shift = models.ForeignKey(Shift, related_name="cash_transactions", on_delete=models.PROTECT)
    branch = models.ForeignKey(Branch, related_name="cash_transactions", on_delete=models.PROTECT)
    transaction_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=120, blank=True)
    reason = models.CharField(max_length=240, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )

    class Meta:
        ordering = ["-created_at"]


class PurchaseOrder(TimeStampedModel):
    DRAFT = "draft"
    ORDERED = "ordered"
    PARTIAL = "partial"
    RECEIVED = "received"
    CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (DRAFT, "Draft"),
        (ORDERED, "Ordered"),
        (PARTIAL, "Partial"),
        (RECEIVED, "Received"),
        (CANCELLED, "Cancelled"),
    ]

    po_no = models.CharField(max_length=40, unique=True)
    branch = models.ForeignKey(Branch, related_name="purchase_orders", on_delete=models.PROTECT)
    supplier = models.CharField(max_length=160)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=DRAFT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    expected_at = models.DateField(null=True, blank=True)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.po_no


class PurchaseOrderItem(models.Model):
    purchase_order = models.ForeignKey(PurchaseOrder, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    ordered_quantity = models.PositiveIntegerField()
    received_quantity = models.PositiveIntegerField(default=0)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    @property
    def line_total(self):
        return self.ordered_quantity * self.unit_cost


class StocktakeSession(TimeStampedModel):
    OPEN = "open"
    COUNTED = "counted"
    APPROVED = "approved"
    CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (OPEN, "Open"),
        (COUNTED, "Counted"),
        (APPROVED, "Approved"),
        (CANCELLED, "Cancelled"),
    ]

    session_no = models.CharField(max_length=40, unique=True)
    branch = models.ForeignKey(Branch, related_name="stocktakes", on_delete=models.PROTECT)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=OPEN)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        related_name="approved_stocktakes", on_delete=models.SET_NULL,
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    note = models.CharField(max_length=240, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.session_no


class StocktakeItem(models.Model):
    stocktake = models.ForeignKey(StocktakeSession, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    system_quantity = models.IntegerField(default=0)
    counted_quantity = models.IntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["stocktake", "product"], name="unique_product_per_stocktake"),
        ]

    @property
    def variance(self):
        return self.counted_quantity - self.system_quantity
