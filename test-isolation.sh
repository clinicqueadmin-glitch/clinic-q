#!/bin/bash
APIKEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpY295am5qZXp0Z2lyYndneW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMzIwMzgsImV4cCI6MjEwMjkwODAzOH0.CuwKnV2SjmT6nUT3vqJfJpQ110IKiG5VxF0qbkxnIK4"
BASE="https://yicoyjnjeztgirbwgyot.supabase.co/rest/v1"

# Check unique constraint on clinic_settings
echo "=== CHECK UNIQUE CONSTRAINT ==="
curl -s "$BASE/clinic_settings" -H "apikey: $APIKEY" -H "Authorization: Bearer $APIKEY" | python3 -c "
import json, sys
data = json.load(sys.stdin)
seen = set()
dupes = []
for r in data:
    key = (r['clinic_id'], r['setting_key'])
    if key in seen:
        dupes.append(key)
    seen.add(key)
if dupes:
    print('DUPLICATES FOUND:', dupes)
else:
    print('No duplicates')
print(f'Total settings: {len(data)}')
for r in data:
    print(f'  {r[\"clinic_id\"]} -> {r[\"setting_key\"]}')
"

# Check if clinic_settings has a unique constraint
echo ""
echo "=== CHECK if tv_ads already exists ==="
curl -s "$BASE/clinic_settings?clinic_id=eq.clinic-1788382073429&setting_key=eq.tv_ads" -H "apikey: $APIKEY" -H "Authorization: Bearer $APIKEY"

# Check queues for isolation
echo ""
echo "=== QUEUES per clinic ==="
curl -s "$BASE/queues?select=clinic_id,patient_name,status,queue_date" -H "apikey: $APIKEY" -H "Authorization: Bearer $APIKEY"

# Check daily_rooms for isolation
echo ""
echo "=== DAILY_ROOMS per clinic ==="
curl -s "$BASE/daily_rooms?select=clinic_id,room_date" -H "apikey: $APIKEY" -H "Authorization: Bearer $APIKEY"

# Check completed_procedures for isolation  
echo ""
echo "=== COMPLETED_PROCEDURES ==="
curl -s "$BASE/completed_procedures?select=id,queue_id,name" -H "apikey: $APIKEY" -H "Authorization: Bearer $APIKEY"
