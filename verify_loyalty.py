import requests
import time

BASE_URL = "http://localhost:8081/api"

def test_loyalty_system():
    print("Starting Loyalty System Verification...")
    
    # 1. Register a new user
    user_data = {
        "username": "testuser",
        "password": "password123",
        "email": "test@example.com",
        "name": "Test User",
        "role": ["user"],
        "phone": "12345678"
    }
    
    print(f"Registering user: {user_data['username']}...")
    try:
        resp = requests.post(f"{BASE_URL}/auth/signup", json=user_data)
        print(f"Signup response: {resp.status_code}")
    except Exception as e:
        print(f"Signup failed: {e}")
        return

    # 2. Login
    login_data = {
        "username": "testuser",
        "password": "password123"
    }
    print("Logging in...")
    resp = requests.post(f"{BASE_URL}/auth/signin", json=login_data)
    if resp.status_code != 200:
        print(f"Login failed: {resp.text}")
        return
    
    token = resp.json()['token']
    user_id = resp.json()['id']
    headers = {"Authorization": f"Bearer {token}"}
    print(f"Logged in. User ID: {user_id}")

    # 3. Get services and barbers to find correct IDs
    print("Fetching services and barbers...")
    services_resp = requests.get(f"{BASE_URL}/services")
    barbers_resp = requests.get(f"{BASE_URL}/barbers")
    
    if services_resp.status_code != 200 or barbers_resp.status_code != 200:
        print("Failed to fetch services or barbers")
        return
    
    services = services_resp.json()
    barbers = barbers_resp.json()
    
    coupe_barbe_id = next((s['id'] for s in services if "Coupe + Barbe" in s['name']), None)
    aladin_id = next((b['id'] for b in barbers if "Aladin" in b['name']), None)
    
    if not coupe_barbe_id or not aladin_id:
        print(f"Could not find required IDs: Coupe+Barbe={coupe_barbe_id}, Aladin={aladin_id}")
        return

    print(f"Found IDs: Coupe+Barbe={coupe_barbe_id}, Aladin={aladin_id}")

    # 4. Login as Admin
    admin_data = {
        "username": "admin",
        "password": "adminpassword",
        "email": "admin@example.com",
        "name": "Admin User",
        "role": ["admin"],
        "phone": "87654321"
    }
    print("Registering admin...")
    requests.post(f"{BASE_URL}/auth/signup", json=admin_data)
    
    print("Logging in as admin...")
    resp = requests.post(f"{BASE_URL}/auth/signin", json={"username": "admin", "password": "adminpassword"})
    admin_token = resp.json()['token']
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 5. Simulate 10 appointments
    print("Simulating 10 appointments...")
    for i in range(1, 11):
        # Create appointment using the correct request format
        apt_data = {
            "barberId": aladin_id,
            "serviceIds": [coupe_barbe_id],
            "date": f"2026-03-{i:02d}",
            "startTime": "10:00:00",
            "userName": "Test User",
            "userPhone": "12345678"
        }
        # We book while logged in as user
        resp = requests.post(f"{BASE_URL}/appointments/book", json=apt_data, headers=headers)
        if resp.status_code != 200:
            print(f"Failed to create appointment {i}: {resp.status_code} {resp.text}")
            continue
        
        apt_id = resp.json()['id']
        
        # Mark as DONE (must be admin)
        resp = requests.put(f"{BASE_URL}/appointments/{apt_id}/status", params={"status": "DONE"}, headers=admin_headers)
        if resp.status_code == 200:
            print(f"Appointment {i} (ID: {apt_id}) marked as DONE.")
        else:
            print(f"Failed to mark appointment {i} as DONE: {resp.status_code} {resp.text}")

    # 6. Check user stats
    print("Checking user loyalty stats...")
    resp = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    user_stats = resp.json()
    print(f"Total Appointments: {user_stats.get('totalAppointments')}")
    print(f"Available Rewards: {user_stats.get('availableRewards')}")

    if user_stats.get('availableRewards') >= 1:
        print("SUCCESS: Reward added after 10 appointments!")
    else:
        print("FAILURE: Reward NOT added.")

    # 7. Test reward application
    if user_stats.get('availableRewards') >= 1:
        print("Testing reward application on 11th appointment...")
        apt_data_reward = {
            "barberId": aladin_id,
            "serviceIds": [coupe_barbe_id],
            "date": "2026-03-15",
            "startTime": "14:00:00",
            "userName": "Test User",
            "userPhone": "12345678",
            "useReward": True
        }
        resp = requests.post(f"{BASE_URL}/appointments/book", json=apt_data_reward, headers=headers)
        if resp.status_code == 200:
            apt_id_reward = resp.json()['id']
            print(f"11th appointment with reward created successfully (ID: {apt_id_reward}).")
            
            # Check available rewards (should be decreased)
            resp = requests.get(f"{BASE_URL}/auth/me", headers=headers)
            available_after_booking = resp.json().get('availableRewards')
            print(f"Available Rewards after booking: {available_after_booking}")
            print(f"Used Rewards: {resp.json().get('usedRewards')}")
            
            # 8. Test refund logic
            print(f"Cancelling 11th appointment (ID: {apt_id_reward}) to test refund...")
            resp = requests.put(f"{BASE_URL}/appointments/{apt_id_reward}/cancel", headers=headers)
            print(f"Cancellation response: {resp.status_code}")
            
            resp = requests.get(f"{BASE_URL}/auth/me", headers=headers)
            available_after_cancel = resp.json().get('availableRewards')
            print(f"Available Rewards after cancellation: {available_after_cancel}")
            print(f"Used Rewards: {resp.json().get('usedRewards')}")
            
            if available_after_cancel == available_after_booking + 1:
                print("SUCCESS: Reward refunded correctly!")
            else:
                print("FAILURE: Reward NOT refunded.")
        else:
            print(f"Failed to create appointment with reward: {resp.status_code} {resp.text}")

if __name__ == "__main__":
    test_loyalty_system()
