import cv2
from ultralytics import YOLO
import sounddevice as sd
import numpy as np
import threading
import time
import json
import queue
import paho.mqtt.client as mqtt
import random

# --- Configuration ---
MODEL_PATH = "yolo11n.onnx"  
POLL_INTERVAL = 0       
AUDIO_DURATION = 1      
SAMPLE_RATE = 44100
CALIBRATION_OFFSET = 65  
TOTAL_CHAIRS = 2 

# --- MQTT Configuration ---
BROKER_IP = "10.250.49.230"
BROKER_PORT = 1883
MQTT_TOPIC = "study_area_A/camera"

# The shared payload dictionary & queue
latest_data = {
    "total_seats": TOTAL_CHAIRS, 
    "empty_seats": TOTAL_CHAIRS, 
    "noise_db": 0.0
}
payload_queue = queue.Queue(maxsize=1)

def audio_thread_task():
    """Parallel thread to calculate ambient noise levels."""
    while True:
        recording = sd.rec(int(AUDIO_DURATION * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=1, dtype='float32')
        sd.wait()
        
        rms = np.sqrt(np.mean(recording**2))
        db_fs = 20 * np.log10(rms) if rms > 0 else -100
        db_spl = db_fs + CALIBRATION_OFFSET
        latest_data["noise_db"] = round(float(db_spl), 2)
            
        time.sleep(max(0, POLL_INTERVAL - AUDIO_DURATION))

def vision_thread_task():
    """Main thread polling the camera buffer and counting people."""
    model = YOLO(MODEL_PATH, task="detect") 
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    last_process_time = time.time()
    
    while True:
        # Keep the camera buffer completely empty to avoid video lag
        ret, frame = cap.read() 
        if not ret: continue
            
        current_time = time.time()
        
        if current_time - last_process_time >= POLL_INTERVAL:
            results = model(frame, verbose=False)
            
            # Count people and calculate empty seats
            people_count = sum(1 for box in results[0].boxes if int(box.cls[0]) == 0)
            latest_data["empty_seats"] = max(0, TOTAL_CHAIRS - people_count)
            
            payload = json.dumps(latest_data)
            
            # Update the queue with the freshest payload
            if payload_queue.full():
                try: payload_queue.get_nowait()
                except queue.Empty: pass 
            
            payload_queue.put(payload)
            print(f"[Vision] Processed frame. Payload: {payload}")
            
            last_process_time = current_time

def network_thread_task():
    """Consumer thread that handles MQTT network transmission."""
    client = mqtt.Client(client_id="Pi_Edge_Node")
    
    try:
        client.connect(BROKER_IP, BROKER_PORT)
        client.loop_start() 
        print(f"[Network] Connected to MQTT Broker at {BROKER_IP}")
    except Exception as e:
        print(f"[Network] Failed to connect: {e}")

    while True:
        # Wait safely until a fresh payload appears
        payload_string = payload_queue.get()
        
        try:
            client.publish(MQTT_TOPIC, payload_string)
        except Exception as e:
            print(f"[Network Error] Failed to publish data: {e}")
        finally:
            payload_queue.task_done()

def mock_area_r_vision_task():
    """Independent thread to generate and send mock vision data for Study Area R."""
    mock_client = mqtt.Client(client_id="Pi_A_Mock_Node")
    try:
        mock_client.connect(BROKER_IP, BROKER_PORT)
        mock_client.loop_start()
    except Exception as e:
        print(f"[Mock Network] Failed to connect: {e}")
        return

    while True:
        total_mock_seats = 4
        # Randomize camera seeing 0 to 4 empty seats
        mock_empty = random.randint(0, total_mock_seats) 
        mock_noise = round(random.uniform(45.0, 75.0), 2) # Simulate human chatter
        
        mock_payload = json.dumps({
            "total_seats": total_mock_seats,
            "empty_seats": mock_empty,
            "noise_db": mock_noise
        })
        
        mock_client.publish("study_area_J/camera", mock_payload)
        time.sleep(POLL_INTERVAL)

# --- Start parallel threads ---
threading.Thread(target=audio_thread_task, daemon=True).start()
threading.Thread(target=vision_thread_task, daemon=True).start()
threading.Thread(target=network_thread_task, daemon=True).start()

# Add the new mock thread here:
threading.Thread(target=mock_area_r_vision_task, daemon=True).start()

# Keep the main process alive
try:
    print("Edge Node Active (Production Mode). Processing...")
    while True: 
        time.sleep(1)     
except KeyboardInterrupt:
    print("\nShutting down edge node...")
