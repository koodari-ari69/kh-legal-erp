from django.contrib import admin
from .models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('name', 'business_id', 'email', 'phone', 'city', 'is_active')
    list_filter = ('is_active', 'city')
    search_fields = ('name', 'business_id', 'email')
