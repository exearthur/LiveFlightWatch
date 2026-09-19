import os

# Ensure Settings() can be constructed without a real .env file or a real
# AviationStack API key. Must run before any test module imports app.config
# (directly or transitively via app.main / app.routers.flights).
os.environ.setdefault("AVIATIONSTACK_API_KEY", "test-api-key")
