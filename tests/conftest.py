"""
Pytest configuration and global fixtures.
"""
import sys
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

# Alias legacy_fastapi as backend in sys.modules so pytest test suite continues to function
import legacy_fastapi
import legacy_fastapi.app
sys.modules['backend'] = legacy_fastapi
sys.modules['backend.app'] = legacy_fastapi.app
