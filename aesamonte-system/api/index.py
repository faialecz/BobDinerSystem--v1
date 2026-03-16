import sys
import os

# Add backend/ to path so Flask blueprints can be imported
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app import app
