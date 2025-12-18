import os
import django
from django.urls import get_resolver

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

resolver = get_resolver()
url_patterns = resolver.url_patterns

def print_urls(patterns, prefix=''):
    for pattern in patterns:
        if hasattr(pattern, 'url_patterns'):
            print_urls(pattern.url_patterns, prefix + pattern.pattern.regex.pattern)
        else:
            print(f"{prefix}{pattern.pattern.regex.pattern} -> {pattern.name}")

print("Checking for review endpoints...")
# We know it should be under api/content/
# Let's just list everything under api/content/
from content.urls import router
for url in router.urls:
    print(url)
