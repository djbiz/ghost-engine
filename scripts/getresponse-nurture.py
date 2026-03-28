#!/usr/bin/env python3
"""
Ghost Monetization Engine — GetResponse Nurture Integration
Manages the 5-email nurture sequence via GetResponse API
"""

import os
import sys
import requests
import json
from datetime import datetime, timedelta

GETRESPONSE_API_KEY = os.environ.get("GETRESPONSE_API_KEY", "skmjubsb3y7xgv4txdy16jziwcea66t6")
BASE_URL = "https://api.getresponse.com/v3"
HEADERS = {
    "X-Auth-Token": f"api-key {GETRESPONSE_API_KEY}",
    "Content-Type": "application/json"
}

CAMPAIGN_ID = "LupL9"  # Ghost Engine Nurture campaign

def add_contact(name, email, tag=None):
    """Add a contact to the Ghost Engine Nurture campaign."""
    payload = {
        "campaign": {"campaignId": CAMPAIGN_ID},
        "email": email,
    }
    if name:
        parts = name.split(" ", 1)
        payload["name"] = parts[0]
        if len(parts) > 1:
            payload["lastName"] = parts[1]

    resp = requests.post(f"{BASE_URL}/contacts", headers=HEADERS, json=payload)
    if resp.status_code == 200:
        contact = resp.json()
        contact_id = contact.get("contactId")
        print(f"[OK] Added: {email} ({contact_id})")

        # Add tag if provided
        if tag:
            tag_resp = requests.post(
                f"{BASE_URL}/contacts/{contact_id}/tags",
                headers=HEADERS,
                json({"name": tag})
            )
            print(f"    Tag '{tag}' added: {tag_resp.status_code == 200}")
        return contact_id
    elif resp.status_code == 409:
        print(f"[SKIP] Already exists: {email}")
        return None
    else:
        print(f"[ERROR] {email}: {resp.status_code} {resp.text}")
        return None

def get_campaigns():
    """List all campaigns."""
    resp = requests.get(f"{BASE_URL}/campaigns", headers=HEADERS)
    print(json.dumps(resp.json(), indent=2))

def get_sequence_emails():
    """List all emails in the Ghost Nurture campaign."""
    resp = requests.get(f"{BASE_URL}/campaigns/{CAMPAIGN_ID}/messages", headers=HEADERS)
    print(json.dumps(resp.json(), indent=2))

def send_campaign_email(campaign_id, subject, body_html, body_text):
    """Create a campaign email (newsletter type)"""
    payload = {
        "campaign": {"campaignId": campaign_id},
        "subject": subject,
        "type": "newsletter",
        "content": {
            "html": body_html,
            "plain": body_text
        },
        "flags": ["opentracking", "clicktracking"]
    }
    resp = requests.post(f"{BASE_URL}/messages", headers=HEADERS, json=payload)
    print(f"Email created: {resp.status_code}", resp.json().get("messageId", ""))

def run_sequence():
    """
    Run the 5-email nurture sequence setup.
    Emails are scheduled relative to contact added date.
    """
    print("Ghost Engine Nurture Sequence Setup")
    print("=" * 40)
    print(f"Campaign: {CAMPAIGN_ID}")
    print("Emails: 5 (Day 0, 2, 5, 9, 14)")
    print()
    print("Note: GetResponse automation (autoresponders) must be configured")
    print("in the GetResponse UI. The API creates the campaign + contacts.")
    print()
    print("Next steps:")
    print("1. Go to: https://app.getresponse.com/campaigns")
    print("2. Open 'Ghost Engine Nurture' campaign")
    print("3. Set up autoresponder: trigger = contact.added")
    print("4. Add 5 emails with delays: 0, 2, 5, 9, 14 days")

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"

    if cmd == "add":
        if len(sys.argv) < 4:
            print("Usage: python3 getresponse-nurture.py add 'Name' 'email@example.com' [tag]")
            sys.exit(1)
        name = sys.argv[2]
        email = sys.argv[3]
        tag = sys.argv[4] if len(sys.argv) > 4 else "ghost-lead"
        add_contact(name, email, tag)

    elif cmd == "campaigns":
        get_campaigns()

    elif cmd == "setup":
        run_sequence()

    elif cmd == "help":
        print("Commands:")
        print("  add 'Name' 'email' [tag]  - Add contact to nurture campaign")
        print("  campaigns                - List all campaigns")
        print("  setup                    - Show sequence setup instructions")
        print("  help                     - This help")
