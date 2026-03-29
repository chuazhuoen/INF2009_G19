import threading
from time import sleep
from collections import deque
import paho.mqtt.client as mqtt
import json
from gpiozero import DistanceSensor
import random

# =========================
# MQTT SETUP
# =========================
BROKER = "10.250.49.230"
PORT = 1883

client = mqtt.Client(client_id="SeatPublisher")
client.connect(BROKER, PORT)
client.loop_start()

# =========================
# CONSTANTS & TRACKING
# =========================
TOPDOWN_THRESHOLD = 25      # cm
HORIZONTAL_THRESHOLD = 40   # cm
DEBOUNCE_COUNT = 2
POLL_INTERVAL = 2           # seconds

# =========================
# SENSOR SETUP
# =========================

# ---- Seat 1 ----
seat1_top = DistanceSensor(trigger=23, echo=24, max_distance=2)
seat1_side = DistanceSensor(trigger=27, echo=22, max_distance=2)
seat1_history = deque(maxlen=DEBOUNCE_COUNT)
seat1_confirmed = "VACANT"

# ---- Seat 2 ----
seat2_top = DistanceSensor(trigger=13, echo=26, max_distance=2)
seat2_side = DistanceSensor(trigger=5, echo=6, max_distance=2)
seat2_history = deque(maxlen=DEBOUNCE_COUNT)
seat2_confirmed = "VACANT"

# =========================
# FUNCTIONS
# =========================

def get_avg_distance(sensor, samples=20):
    readings = []
    for _ in range(samples):
        d = sensor.distance * 100
        if 0 < d < 99.0:
            readings.append(d)
        sleep(0.01)

    if not readings:
        return None

    return round(sum(readings) / len(readings), 2)

def determine_seat_status(dist_top, dist_side, last_confirmed):
    if dist_top is None and dist_side is None:
        return last_confirmed
    if dist_top is None:
        chair_pulled = dist_side < HORIZONTAL_THRESHOLD
        return "OCCUPIED" if chair_pulled else "VACANT"
    if dist_side is None:
        legs_detected = dist_top < TOPDOWN_THRESHOLD
        return "OCCUPIED" if legs_detected else "VACANT"

    legs_detected = dist_top < TOPDOWN_THRESHOLD
    chair_pulled  = dist_side < HORIZONTAL_THRESHOLD
    return "OCCUPIED" if (legs_detected and chair_pulled) else "VACANT"

def process_seat(seat_id, top_sensor, side_sensor, history, confirmed_status, topic):
    dist_top = get_avg_distance(top_sensor, samples=20)
    dist_side = get_avg_distance(side_sensor, samples=20)

    raw_status = determine_seat_status(dist_top, dist_side, confirmed_status)

    if raw_status is not None:
        history.append(raw_status)
        if len(history) == DEBOUNCE_COUNT and len(set(history)) == 1:
            confirmed_status = history[-1]

    # Convert the string status to a boolean for Pi C
    is_occupied = (confirmed_status == "OCCUPIED")
    
    # Send the exact format Pi C expects
    mqtt_payload = {"occupied": is_occupied}
    client.publish(topic, json.dumps(mqtt_payload))

    # Clean single-line logging just to show it is working
    print(f"Seat {seat_id} | Status: {confirmed_status:<8} | Top: {dist_top}cm | Side: {dist_side}cm")
    
    return confirmed_status

def seat_worker(seat_id, top_sensor, side_sensor, history, confirmed_status, topic):
    # Stagger thread start to prevent acoustic crosstalk between sensors
    if seat_id == 2:
        sleep(0.2)

    while True:
        confirmed_status = process_seat(
            seat_id, top_sensor, side_sensor, history, confirmed_status, topic
        )
        sleep(POLL_INTERVAL)

def mock_area_r_sensor_worker():
    """Independent thread to send mock ultrasonic sensor data for Study Area R."""
    while True:
        # Mock 4 distinct chairs to match the mock camera's capacity
        for seat_num in range(1, 5):
            is_occupied = random.choice([True, False])
            mock_payload = json.dumps({"occupied": is_occupied})
            topic = f"study_area_J/sensor/mock_chair_{seat_num}"
            
            client.publish(topic, mock_payload)
            
        sleep(POLL_INTERVAL)

# =========================
# MAIN EXECUTION
# =========================
print("Starting dual-threaded sensor node (Production Mode)...")

t1 = threading.Thread(target=seat_worker, args=(1, seat1_top, seat1_side, seat1_history, seat1_confirmed, "study_area_A/sensor/1"), daemon=True)
t1.start()

t2 = threading.Thread(target=seat_worker, args=(2, seat2_top, seat2_side, seat2_history, seat2_confirmed, "study_area_A/sensor/2"), daemon=True)
t2.start()

# Add the new mock thread here:
t_mock = threading.Thread(target=mock_area_r_sensor_worker, daemon=True)
t_mock.start()
try:
    # Keep the main program alive
    while True:
        sleep(1)
        
except KeyboardInterrupt:
    print("\nShutting down sensor node...")
