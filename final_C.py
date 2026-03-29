import paho.mqtt.client as mqtt
import json
import time
import logging
import socket
import threading
from logging.handlers import RotatingFileHandler
from websocket_server import WebsocketServer
import requests

API_URL = "https://yckgmb8guj.execute-api.us-east-1.amazonaws.com/status"

# ==========================================
# CONFIGURATION
# ==========================================
BROKER_IP = "10.250.49.230"      
BROKER_PORT = 1883
CLOUD_UPLOAD_INTERVAL = 10   
NODE_TIMEOUT = 60            

TOPICS_TO_SUBSCRIBE = [
    ("+/camera", 0),
    ("+/sensor/+", 0) 
]

active_areas = {} 

# ==========================================
# DIAGNOSTIC LOGGING SETUP
# ==========================================
log_file_path = "edge_diagnostics.log" 
diagnostic_logger = logging.getLogger("EdgeDiagnostics")
diagnostic_logger.setLevel(logging.INFO)

handler = RotatingFileHandler(log_file_path, maxBytes=5*1024*1024, backupCount=2)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
diagnostic_logger.addHandler(handler)

# ==========================================
# LOCAL WEBSOCKET SETUP (For Local HDMI Display)
# ==========================================
WS_PORT = 9001
ws_server = WebsocketServer(host='0.0.0.0', port=WS_PORT)

def new_ws_client(client, server):
    print(f"🌐 [Local UI] Monitor connected from {client['address']}")

ws_server.set_fn_new_client(new_ws_client)

def start_ws_server():
    ws_server.run_forever()

# Start WebSocket server in a background thread
threading.Thread(target=start_ws_server, daemon=True).start()

# ==========================================
# FUNCTIONS
# ==========================================
def is_internet_available(host="8.8.8.8", port=53, timeout=2):
    """Fast check to see if the edge node is online."""
    try:
        # 1. Create a specific socket
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        
        # 2. Apply the timeout ONLY to this one socket
        s.settimeout(timeout) 
        
        # 3. Attempt the connection
        s.connect((host, port))
        
        # 4. Clean up and close
        s.close() 
        return True
    except Exception:
        return False

def send_to_cloud(payload):
    try:
        r = requests.post(API_URL, json=payload, timeout=5)
        print(f"☁️  [CLOUD] {payload['studyarea_id']} → HTTP {r.status_code} | Occ:{payload['occupied_seats']} Res:{payload['reserved_seats']} Emp:{payload['empty_seats']} Noise:{payload['noise_level']}dB")
        diagnostic_logger.info(f"[CLOUD] Upload OK for {payload['studyarea_id']} | HTTP {r.status_code}")
    except Exception as e:
        print(f"❌ [CLOUD] Upload failed: {e}")
        diagnostic_logger.error(f"[CLOUD] Upload failed for {payload['studyarea_id']}: {e}")

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"✅ Connected to local Broker at {BROKER_IP}:{BROKER_PORT}!")
        client.subscribe(TOPICS_TO_SUBSCRIBE)
        print("🎧 Listening for dynamic area data...")
    else:
        print(f"❌ Failed to connect, return code {rc}")

def on_message(client, userdata, msg):
    receive_time = time.time()
    topic_parts = msg.topic.split("/")
    
    if len(topic_parts) < 2: return 
        
    area_id = topic_parts[0]  
    device_type = topic_parts[1]
    
    if area_id not in active_areas:
        print(f"🌟 [System] New location discovered: {area_id}")
        active_areas[area_id] = {
            "camera": {"total_seats": 2, "empty_seats": 2, "noise_db": 0, "last_seen": 0},
            "sensors": {}
        }
        
    try:
        payload = json.loads(msg.payload.decode('utf-8'))

        if "send_timestamp" in payload:
            latency_ms = (receive_time - payload["send_timestamp"]) * 1000
            print(f"📡 [Network Profile] {device_type.upper()} Latency: {latency_ms:.2f} ms")
        
        if device_type == "camera":
            if "total_seats" in payload:
                active_areas[area_id]["camera"]["total_seats"] = payload["total_seats"]
                
            active_areas[area_id]["camera"]["empty_seats"] = payload.get("empty_seats", active_areas[area_id]["camera"]["total_seats"])
            active_areas[area_id]["camera"]["noise_db"] = payload.get("noise_db", 0)
            active_areas[area_id]["camera"]["last_seen"] = receive_time
            
        elif device_type == "sensor" and len(topic_parts) == 3:
            sensor_id = topic_parts[2]
            if sensor_id not in active_areas[area_id]["sensors"]:
                active_areas[area_id]["sensors"][sensor_id] = {}
                
            active_areas[area_id]["sensors"][sensor_id]["occupied"] = payload.get("occupied", False)
            active_areas[area_id]["sensors"][sensor_id]["last_seen"] = receive_time
            
    except json.JSONDecodeError:
        pass 

# ==========================================
# MAIN EXECUTION
# ==========================================
client = mqtt.Client(client_id="Pi_C_Gateway_Node")
client.on_connect = on_connect
client.on_message = on_message

print("🚀 Starting Edge Gateway service...")

while True:
    try:
        client.connect(BROKER_IP, BROKER_PORT)
        break 
    except (ConnectionRefusedError, OSError):
        time.sleep(5)

client.loop_start() 

#State Cache to track the last uploaded seat configuration
last_known_state = {}
was_online = True

try:
    while True:
        time.sleep(CLOUD_UPLOAD_INTERVAL)
        current_time = time.time()
        
        # 1. CIRCUIT BREAKER (With Anti-Spam Toggle)
        is_online = is_internet_available()
        
        if not is_online and was_online:
            print("\n⚠️  [NETWORK WARNING] Internet connection lost! Circuit breaker ENGAGED.")
        elif is_online and not was_online:
            print("\n✅  [NETWORK RESTORED] Internet connection found! Circuit breaker DISENGAGED.\n")
            
            last_known_state.clear() 
            
        was_online = is_online
        
        for area_id, state in list(active_areas.items()):
            
            total_area_seats = state["camera"]["total_seats"]
            
            # --- Health Checks ---
            camera_alive = (current_time - state["camera"]["last_seen"]) < NODE_TIMEOUT
            camera_vacant = state["camera"]["empty_seats"]
            
            active_sensor_count = 0
            occupied_sensor_count = 0
            
            for s_id, sensor in state["sensors"].items():
                if (current_time - sensor.get("last_seen", 0)) < NODE_TIMEOUT:
                    active_sensor_count += 1
                    if sensor.get("occupied") == True:
                        occupied_sensor_count += 1
                        
            sensors_alive = active_sensor_count > 0
            
            # --- Sensor Fusion Logic ---
            if camera_alive and sensors_alive:
                source = "camera+ultrasonic"
                camera_occupied = total_area_seats - camera_vacant
                empty_seats = total_area_seats - occupied_sensor_count
                occupied_seats = min(camera_occupied, occupied_sensor_count)
                reserved_seats = occupied_sensor_count - occupied_seats
                
            elif camera_alive and not sensors_alive:
                source = "camera_only"
                empty_seats = camera_vacant
                occupied_seats = total_area_seats - camera_vacant
                reserved_seats = 0
                
            elif sensors_alive and not camera_alive:
                source = "ultrasonic_only"
                empty_seats = total_area_seats - occupied_sensor_count
                occupied_seats = occupied_sensor_count 
                reserved_seats = 0
                
            else:
                continue 
                
            empty_seats = max(0, empty_seats)
            occupied_seats = max(0, occupied_seats)
            reserved_seats = max(0, reserved_seats)
            noise = state["camera"]["noise_db"]

            # ==========================================
            # STATE-CHANGE CACHE LOGIC
            # ==========================================
            current_seat_status = (occupied_seats, reserved_seats, empty_seats)
            
            # Check if this area is new, OR if the seat numbers have changed
            if area_id not in last_known_state or last_known_state[area_id] != current_seat_status:

                # --- Write to Local Diagnostic Log ---
                log_msg = f"[{area_id}] Occ:{occupied_seats} | Res:{reserved_seats} | Emp:{empty_seats} | Noise:{noise}dB | Source:{source}"
                diagnostic_logger.info(log_msg)

                # --- Build Clean Payload ---
                cloud_payload = {
                    "studyarea_id": area_id,
                    "timestamp": int(current_time),
                    "occupied_seats": occupied_seats,
                    "reserved_seats": reserved_seats,
                    "empty_seats": empty_seats,
                    "noise_level": noise
                }
                
                # --- DISPATCH LOGIC ---
                try:
                    ws_server.send_message_to_all(json.dumps(cloud_payload))
                except Exception as e:
                    diagnostic_logger.error(f"WebSocket broadcast failed: {e}")

                if is_online:
                    send_to_cloud(cloud_payload)
                    # Cache the state ONLY after we successfully process it
                    last_known_state[area_id] = current_seat_status
                else:
                    diagnostic_logger.warning(f"[{area_id}] Bypassing cloud upload (Network Unreachable).")
                    
                    last_known_state[area_id] = current_seat_status

except KeyboardInterrupt:
    print("\n🛑 Shutting down Gateway...")
    client.loop_stop() 
    client.disconnect()