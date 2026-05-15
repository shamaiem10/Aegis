import asyncio
import json
import os
import sys
from pathlib import Path

# Add the backend directory to sys.path so we can import config
backend_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(backend_dir))

from google.cloud import firestore as gc_firestore
from config import get_settings

MOCK_ROOT = backend_dir / "mock_data"

async def main():
    settings = get_settings()
    cred_path = (settings.google_application_credentials or "").strip()
    if cred_path:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_path
        
    proj = settings.firebase_project_id or settings.google_cloud_project
    client = gc_firestore.Client(project=proj)
    
    print(f"Connecting to Firestore for project: {proj}")
    
    resource_file = MOCK_ROOT / "resource_inventory.json"
    if not resource_file.exists():
        print("Resource file not found.")
        return
        
    with open(resource_file, "r") as f:
        data = json.load(f)
        
    units = data.get("units", [])
    col = client.collection("resources")
    
    for u in units:
        doc_id = u["resource_id"]
        col.document(doc_id).set(u)
        print(f"Seeded resource: {doc_id}")
        
    print("Done seeding resources.")

if __name__ == "__main__":
    asyncio.run(main())
