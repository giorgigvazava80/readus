from django.contrib import admin

from .models import WriterApplication

@admin.register(WriterApplication)
class WriterApplicationAdmin(admin.ModelAdmin):
    list_display = ('user', 'status', 'created_at', 'reviewed_at')
    list_filter = ('status',)
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('created_at', 'reviewed_at')
