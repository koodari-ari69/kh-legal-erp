from django.shortcuts import render
from .models import Customer


def customer_list(request):
    customers = Customer.objects.filter(is_active=True).order_by('name')
    return render(request, 'customers/customer_list.html', {'customers': customers})
