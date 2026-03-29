# Real-Time Smart Study Space: </br> Edge-Based Seat Occupancy & Noise Classification

## INF2009 Group 19
| Name            | Student ID | 
| :---------------- | :------: |
| Chua Zhuo En       |   2302292   | 
| Kok Shan Jin           |   2301774   | 
| Toh Shun Cheng Ryan |  2302024   | 
| Lok Jeron |  2301833   |
| Lee Yu Xuan |  2302178   |
 
## Table of Contents
 
- [Project Overview](#project-overview)
- [Problem Statement](#problem-statement)
- [Objectives](#objectives)
- [System Architecture](#system-architecture)
- [Hardware & Justification](#hardware--justification)
- [Software & Tools](#software--tools)
- [Edge Analytics — ML Model](#edge-analytics--ml-model)
- [Data Flow & Communication](#data-flow--communication)
- [Cloud Infrastructure](#cloud-infrastructure)
- [Dashboard](#dashboard)
- [System Resilience & Graceful Degradation](#system-resilience--graceful-degradation)
- [Experiments & Results](#experiments--results)
- [Latency Analysis](#latency-analysis)
- [Scalability](#scalability)
- [Future Extensions](#future-extensions)

## Project Overview
 
Study spaces in university libraries and common areas are scarce, yet students lack live information about seat availability, leading to repeated physical searches and wasted time — especially during peak exam periods.
 
This project delivers a **real-time, edge-first monitoring system** that tracks seat occupancy and ambient noise levels across multiple study areas. The system leverages **edge computing** to process raw sensor data locally (on Raspberry Pi devices) before publishing summarised results to a cloud-hosted dashboard — minimising latency, reducing bandwidth, and enabling offline-first resilience.

## Problem Statement
 
| Problem | Description |
|---|---|
| **No Seat Visibility** | Students walk room-to-room to find a spot, wasting time during peak periods. |
| **"Chope" Ambiguity** | Bags & laptops make seats appear occupied when the owner is absent. |
| **No Noise Awareness** | Students cannot gauge ambient noise levels before entering a space. |

## Objectives
 
- Deploy a machine learning model on **RPi A** for real-time empty seat detection.
- Fuse ultrasonic sensor data (Seat 1 & 2) with model inference to detect **seat reservation** (the "chope" problem).
- Publish seat and noise information to a **cloud-hosted dashboard**.
- Demonstrate the system remains **partially functional** when a data source is interrupted.
- Show **offline-first operation** so the local pipeline continues when Wi-Fi drops.

## System Architecture
 
The system is structured across **three layers**: Device, Edge, and Cloud. It leverages edge-computing, graceful degradation, and serverless cloud architecture to provide a responsive, robust, and cost-saving solution for study space monitoring

<img width="3827" height="1534" alt="architecture_diagram" src="https://github.com/user-attachments/assets/4cc3cfd8-fbe3-4edd-9310-70ca572877cb" />

## Hardware & Justification
 
### Device Layer
 
| Component | Role | Justification |
|---|---|---|
| **Logitech Webcam** (with mic) | Captures still images and ambient audio | USB connectivity, compatible with RPi; single device captures both visual and audio data, reducing component count |
| **Ultrasonic Sensors (×2 per seat)** | Detects presence of items on a chair | Camera has a blind spot at close range directly below its field of view; ultrasonic sensors address this. Two sensors per seat increase accuracy via redundancy |
 
### Edge Layer
 
#### RPi A — Inference Node
 
| Attribute | Detail |
|---|---|
| **Device** | Raspberry Pi 5 |
| **Role** | Runs YOLOv11-Nano for human detection; captures ambient noise via microphone |
| **Justification** | Inference requires all 4 ARM Cortex-A76 cores. Testing showed uncapped inference causes **thermal throttling** within 10 minutes. A frame cap of **1 frame per 5 seconds** was applied — acceptable for study rooms since students take several seconds to settle. With this cap, the RPi 5 operates stably. |
| **Minimum Hardware** | RPi 4 (4 cores, 2 GB RAM) — model requires ~740 MB; 2 GB accounts for system overhead |
| **Scaling Potential** | RPi 5 with time division multiplexing (TDM) is predicted to support up to **5 cameras**: inference takes 170 ms per frame, giving a 17% duty cycle with 83% idle time to cool down |
 
#### RPi B — Sensor Node
 
| Attribute | Detail |
|---|---|
| **Device** | Raspberry Pi 5 |
| **Role** | Reads ultrasonic sensor data and determines chair occupancy state |
| **Justification** | CPU monitoring revealed that RPi B is **overspecified** for this role — ultrasonic polling and MQTT publishing barely use any CPU. A microcontroller such as an **ESP32** would be sufficient, significantly lowering cost. RPi B was retained for this prototype as it was available, but replacement with ESP32 is noted as a recommended hardware optimisation. |
 
#### RPi C — Gateway / Fusion Node
 
| Attribute | Detail |
|---|---|
| **Device** | Raspberry Pi 5 |
| **Role** | Runs MQTT broker, fuses data from RPi A and B, uploads to cloud, hosts local dashboard server |
| **Justification** | Handles diverse concurrent tasks. Stress testing with all processes pinned to a single core (`taskset -c 0`) showed the RPi could handle all tasks, suggesting a single-core device might suffice. However, a baseline memory of **837 MB** is required — largely due to the Chromium rendering engine for the local dashboard. Since most single-core edge devices carry only 512 MB RAM, a **RPi 4 with 2 GB RAM** is the theoretical minimum. An **RPi 5 with 8 GB RAM** allows headroom for additional features. |

## Software & Tools
 
| Category | Tool / Technology | Justification |
|---|---|---|
| **ML Inference** | YOLOv11-Nano | Lightweight YOLO variant suited for edge devices with limited compute; Nano model fits within ~740 MB memory budget |
| **Communication Protocol** | MQTT (Mosquitto Broker on RPi C) | Lightweight pub/sub protocol ideal for IoT; low overhead compared to HTTP for intra-edge messaging |
| **Cloud Backend** | AWS Lambda + API Gateway | Serverless — scales automatically with no idle server costs; triggered by HTTP POST from RPi C |
| **Cloud Database** | Amazon DynamoDB | NoSQL, serverless, low-latency reads; suitable for time-series seat status data |
| **Static Hosting** | Amazon S3 | Cost-effective static site hosting for the React dashboard |
| **Frontend Dashboard** | React (JSX) | Component-based UI; deployed as a static build to S3; supports mobile-responsive layouts |
| **Logging** | 5 MB Rotating Logger | Prevents storage overflow on edge devices while maintaining diagnostic history of timestamps, payloads, and data source states |
| **Resilience** | Software Circuit Breaker | Monitors WAN connectivity; halts cloud uploads when internet is lost to prevent script hangs and wasted bandwidth |

## Edge Analytics — ML Model
 
### Model: YOLOv11-Nano
 
YOLOv11-Nano is deployed on **RPi A** for real-time human detection in still images captured from the study room webcam.
 
**Why YOLO on the edge?**
- Processing images locally avoids sending raw video streams to the cloud, saving bandwidth and reducing latency.
- YOLOv11-Nano is the smallest variant in the YOLO family, designed explicitly for resource-constrained devices.
- Inference latency of ~170 ms per frame on RPi 5 is acceptable given the 1-frame-per-5-seconds capture rate.
 
**Seat Occupancy Logic (Data Fusion):**
 
```
Input A (Camera):  Human detected in seat area?  → Yes / No
Input B (Sensors): Object detected on chair?     → Yes / No
 
Fusion Logic on RPi C:
  If human detected                    → OCCUPIED
  If no human, but object detected     → RESERVED ("choped")
  If neither                           → VACANT
```
 
This fusion directly addresses the **"chope" problem** — the camera alone cannot distinguish a reserved seat from an empty one.

## Data Flow & Communication
 
```
[Webcam] ──USB──▶ [RPi A]
                     │  1. Capture frame (1 frame / 5s)
                     │  2. Run YOLOv11-Nano inference (~170ms)
                     │  3. Capture noise level (dB) from mic
                     │  4. Publish result to MQTT topic:
                     │     sensor/camera → {human_detected, noise_db}
                     ▼
[Ultrasonic ×2] ─GPIO─▶ [RPi B]
                     │  1. Poll sensors continuously
                     │  2. Determine chair occupancy state
                     │  3. Publish result to MQTT topic:
                     │     sensor/ultrasonic → {seat1, seat2}
                     ▼
                  [RPi C] ← subscribes to all MQTT topics
                     │  1. Receive and validate data freshness
                     │     (>60s without update → node considered disconnected)
                     │  2. Fuse camera + ultrasonic data
                     │  3. Log to rotating 5MB log file
                     │  4. Check circuit breaker (WAN status)
                     │  5. HTTP POST to AWS API Gateway
                     │  6. Serve local dashboard
                     ▼
               [AWS Cloud] → DynamoDB → S3 Dashboard
```

## Cloud Infrastructure
 
| Service | Role |
|---|---|
| **Amazon API Gateway** | Receives HTTP POST from RPi C; routes to Lambda |
| **AWS Lambda** | Processes incoming data; writes to DynamoDB (write path); queries DynamoDB (read path) |
| **Amazon DynamoDB** | Stores seat occupancy records with timestamps |
| **Amazon S3** | Hosts static React dashboard files |
 
**Request Flow (Read — Dashboard Load):**
```
User Browser → HTTP GET → S3 (serve React app)
                        → Lambda → DynamoDB (fetch latest data)
                        → Populate dashboard UI
```
 
**Current Region:** `us-east-1` (US). Latency benchmark to cloud: **~1,185 ms**.  
**Optimisation:** Migrating to an Asia-Pacific region would eliminate most of this network delay, bringing total pipeline latency under 1 second.

## Dashboard
 
The cloud dashboard is a **React single-page application** hosted on S3. It is also served locally by RPi C for offline-first access.
 
**Key features:**
- **Live seat status cards** for each study area — shows free / reserved / occupied counts with a colour-coded occupancy bar
- **Ambient noise meter** — displays dB reading with a visual progress bar and categorical label (Quiet / Moderate / Loud)
- **Suitability verdict** — computed in-browser from seat availability and noise level (e.g., "Good for solo study", "Acceptable", "Not recommended")
- **Auto-refresh** polling with "last updated" timestamps per room
- **Responsive layout** — adapts between mobile and desktop views; carousel mode activates automatically for >5 study areas

### **Dashboard — Desktop View**

<img width="2556" height="1259" alt="dashboard" src="https://github.com/user-attachments/assets/91d5ba48-ff4a-4b69-a331-ad91ed7ccb0a" />

### **Dashboard — Mobile View**

<p align="center">
  <img src="https://github.com/user-attachments/assets/0b84772f-ed8a-40bf-b0bb-c91d3f3534ec" width="250"/><br/>
  <sub>Mobile View — Screen 1</sub>
</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/632fca51-2cd9-4ef2-a57c-332380ed78c5" width="250"/><br/>
  <sub>Mobile View — Screen 2 (scrolled down to show selected room card data)</sub>
</p>


## System Resilience & Graceful Degradation
 
The system is designed to remain at least partially functional under failure conditions.
 
| Failure Scenario | System Response |
|---|---|
| **RPi A (Camera node) goes offline** | RPi C detects stale MQTT timestamp (>60s threshold). Falls back to ultrasonic-only data for occupancy. Log updates tracking state from `camera+ultrasonic` to `ultrasonic_only`. Seat reservation detection is degraded but still functional. |
| **RPi B (Sensor node) goes offline** | System falls back to camera-only data. Seat reservation (chope) detection is unavailable; basic occupancy via YOLO remains. |
| **Wi-Fi / WAN unavailable** | Software circuit breaker halts HTTP POST uploads. RPi C pipeline continues uninterrupted; local dashboard remains accessible. Cloud uploads resume automatically when connectivity is restored. |
| **Storage risk on edge device** | 5 MB rotating logger prevents disk overflow. Oldest logs are overwritten automatically. |

## Experiments & Results
 
### RPi A — Frame Capping Experiment
 
| Condition | Outcome |
|---|---|
| Uncapped inference (full speed) | Thermal throttling within 10 minutes; clock speed reduced automatically |
| 1 frame per 5 seconds (capped) | Stable operation; no thermal throttling; all 4 cores used efficiently |
 
**Finding:** 1 fps/5s is sufficient for study room use — students take several seconds to sit down, so no meaningful detection event is missed.
 
### RPi B — Hardware Sizing
 
CPU monitoring during normal operation showed minimal utilisation.

<img width="1113" height="154" alt="rpi_b_experiment" src="https://github.com/user-attachments/assets/e4a614ce-16e4-42e2-8f4d-c902bb009ae2" />

</br> **Finding:** An **ESP32 microcontroller** is sufficient to replace RPi B, drastically lowering the system's Bill of Materials cost.
 
### RPi C — Single-Core Stress Test
 
All RPi C tasks (MQTT broker, data fusion, cloud upload, local server) were pinned to a single core via `taskset -c 0`.
 
| Metric | Result |
|---|---|
| CPU (1 core) | Able to handle all processes |
| Baseline RAM | ~837 MB (Chromium engine for local dashboard) |
| Theoretical minimum | RPi 4, 2 GB RAM |

> _**htop for RPi C after running taskset -c 0:**_
> 
> <img width="1469" height="176" alt="rpi_c_experiment" src="https://github.com/user-attachments/assets/d2403967-618c-4789-9f65-7177f7882d16" />


## Latency Analysis
 
| Pipeline Stage | Latency |
|---|---|
| RPi A — Camera inference (full pipeline) | ~216.6 ms |
| RPi B — Ultrasonic sensor processing | ~408.7 ms |
| RPi C — Data fusion | ~0.01 ms |
| Cloud upload (US East region) | ~1,185 ms |
| **Total end-to-end latency** | **~1.6 seconds** |
 
**SLA met:** The 2-second seat status update SLA is satisfied with the current US-region cloud setup.
 
**Optimisation:** Migrating the cloud server to an Asia-Pacific region would eliminate most network delay, bringing total latency well under 1 second.

## Scalability
 
The system is designed for straightforward expansion:
 
- **New study areas** can be added by deploying additional RPi A + RPi B pairs.
- RPi C dynamically detects new MQTT topics and fuses incoming data without manual reconfiguration.
- The dashboard automatically populates new study area cards upon receiving data — no frontend changes required.
- With an **RPi 5** running TDM, a single inference node can theoretically support up to **5 cameras** (17% duty cycle per camera, 83% idle/cool-down time).
 
## Future Extensions
 
| Extension | Rationale |
|---|---|
| **Replace ultrasonic with weight sensors** | One sensor per seat; more reliable; simpler wiring; lower cost |
| **Replace RPi B with ESP32** | Microcontroller is sufficient for sensor polling + MQTT; drastically reduces cost |
| **Migrate cloud to Asia region** | Eliminates ~1,185 ms network delay; brings total latency under 1 second |
| **Occupancy trend analytics** | DynamoDB historical data can reveal peak hours, popular areas, and usage patterns |
| **Expand to more study areas** | Minimal changes needed thanks to scalable architecture |
