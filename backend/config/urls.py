from django.contrib import admin
from django.urls import include, path


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/pos/", include("pos.urls")),
    path("api/inventory/", include("inventory.urls")),
]
