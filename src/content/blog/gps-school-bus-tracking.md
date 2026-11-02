---
title: "Building a GPS School Bus Tracking System"
description: "An ESP32 and NEO-6M GPS tracker with SIM800L uploads, geofencing, and a live dashboard, plus the power, privacy, and reliability problems that matter."
date: 2026-11-02
updated: 2026-11-02
author: "Ajmal Ali"
category: "Projects"
tags:
  - ESP32
  - GPS
  - IoT
  - SIM800L
  - Electronics
cover: "/images/blog/gps-school-bus-tracking/hero.jpg"
coverAlt: "ESP32 GPS school bus tracker with NEO-6M module, SIM800L, and antenna"
draft: false
---

A school bus tracker is a project where the technology is the easy part. The hard parts are power, connectivity, and the fact that you are handling location data about children. Build it as a prototype on a model bus and it is a great lesson in telemetry. Build it carelessly on a real bus and it is a privacy problem with a battery attached.

The version I would build uses an ESP32, a NEO-6M GPS module, and a SIM800L GSM module. The ESP32 reads the GPS sentences, filters out bad fixes, checks whether the bus has entered or left a geofence, and uploads a small JSON payload to a server. A dashboard shows the latest position and the arrival events. It is a complete telemetry pipeline in a box that fits in a lunchbox.

## What the system needs to do

The core requirement is simple: report the bus's location every thirty seconds, and send an event when it arrives at school or at a stop. That means the device needs a position fix, a clock, a network connection, and a way to store data when the network is unavailable.

A position fix is not the same as a valid position. The GPS module reports latitude and longitude as soon as it has enough satellites, but the first fixes after a cold start can be hundreds of metres off. The fix quality is reported as HDOP, the horizontal dilution of precision, and as a satellite count. A fix with four satellites and a high HDOP is not good enough for a geofence.

The network is the second problem. The SIM800L is a 2G module. In many countries, 2G has been shut down or is being retired. Check that 2G still works where you live before you build around this module. If it does not, use a 4G module such as the SIM7600 or a board with an LTE-M/NB-IoT modem. The architecture is the same; the power and cost are not.

The third problem is power. The SIM800L can draw a peak current of around 2 A during a transmission. That is not a typo. It needs a supply that can deliver that surge without dropping below about 3.4 V, or the module will reset or fail to register. The ESP32's 3.3 V regulator cannot do it, and the 5 V pin on a USB board cannot do it either.

## Wiring and power design

The GPS module runs from 3.3–5 V and draws about 50 mA. The SIM800L runs from about 3.4–4.4 V, with a nominal 4.0 V, and needs a buck converter rated for at least 2 A. Do not power it from the ESP32's 3.3 V rail. Use a separate buck converter from the battery, add a 1000 µF low-ESR capacitor close to the SIM800L's power pins, and connect all grounds together.

| Signal | ESP32 pin | Notes |
| --- | --- | --- |
| GPS TX | GPIO 16 | ESP32 UART2 RX |
| GPS RX | GPIO 17 | ESP32 UART2 TX |
| GPS VCC | 3.3 V or 5 V | Check module label |
| SIM800L TX | GPIO 26 | ESP32 UART1 RX |
| SIM800L RX | GPIO 27 | ESP32 UART1 TX |
| SIM800L PWRKEY | GPIO 4 via transistor | Pulse to power on |
| SIM800L VCC | 4.0 V buck | 2 A supply, 1000 µF cap |
| Battery sense | GPIO 34 | Divider from battery |
| Ignition sense | GPIO 35 | Divider, input-only |
| Status LED | GPIO 2 | Optional |
| Buzzer | GPIO 25 | Optional |

The SIM800L's logic levels are 3.3 V, but its RX pin can be damaged by a 5 V signal. The ESP32 is 3.3 V, so direct connection is fine. The PWRKEY pin needs a pulse to turn the module on; a small NPN transistor or MOSFET driven by a GPIO is the reliable way to do it. Do not connect PWRKEY directly to a GPIO and hope for the best.

The GPS antenna needs a clear view of the sky. Inside a building, it will not get a fix, and no amount of code will change that. For a demo, put the antenna near a window or use a GPS repeater. For a real installation, mount it on the roof with a ground plane.

![IMAGE PLACEHOLDER: Power architecture diagram showing battery, buck converter, SIM800L capacitor, ESP32, and GPS](/images/gps-school-bus-tracking-image-01.jpg)

## Reading GPS data without trusting it

The NEO-6M outputs NMEA sentences over a serial UART at 9600 baud by default. The TinyGPSPlus library parses them and exposes latitude, longitude, speed, course, satellites, and HDOP. The important part is not parsing; it is deciding when a fix is good enough to use.

```cpp
#include <TinyGPSPlus.h>

TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

void setupGps() {
  gpsSerial.begin(9600, SERIAL_8N1, 16, 17);
}

bool hasGoodFix() {
  if (!gps.location.isValid()) return false;
  if (gps.location.age() > 5000) return false;
  if (gps.hdop.isValid() && gps.hdop.hdop() > 5.0) return false;
  if (gps.satellites.isValid() && gps.satellites.value() < 5) return false;
  return true;
}
```

The age check matters because the library keeps the last valid location even when the data stops arriving. A stale fix can look valid while the bus is moving. If the age is more than a few seconds, treat the position as unknown.

The HDOP threshold is a judgement call. A value below 2 is excellent, 2–5 is acceptable, and above 5 is poor. In an urban canyon, the position can jump by tens of metres even with a good satellite count, because the signals bounce off buildings. A median filter over the last few fixes helps, but it adds lag. For a bus tracker, a little lag is acceptable; a wrong geofence event is not.

The GPS also provides time. Use it to timestamp the data when the network is unavailable. The NEO-6M has a backup battery or supercapacitor on many boards; without it, every cold start takes longer. If the board does not have one, add a small coin cell or a supercapacitor to the V_BCKP pin according to the module's datasheet.

## Geofencing without false alarms

A geofence is a circle around a point. The distance between the bus and the school is computed with the haversine formula, and the bus is "inside" if the distance is less than the radius. The naive implementation sends an event every time the condition changes, which is exactly what you want, except when the GPS jitters across the boundary.

Use hysteresis: a larger radius to enter and a smaller radius to leave, or require the condition to hold for two consecutive fixes. That prevents a bus parked at the edge of the geofence from generating a stream of arrival and departure events.

```cpp
#include <math.h>

double distanceMetres(double lat1, double lon1, double lat2, double lon2) {
  const double R = 6371000.0;
  double p1 = lat1 * M_PI / 180.0;
  double p2 = lat2 * M_PI / 180.0;
  double dp = (lat2 - lat1) * M_PI / 180.0;
  double dl = (lon2 - lon1) * M_PI / 180.0;
  double a = sin(dp/2)*sin(dp/2) + cos(p1)*cos(p2)*sin(dl/2)*sin(dl/2);
  return 2 * R * atan2(sqrt(a), sqrt(1-a));
}
```

Store the geofence centre and radius in configuration, not in code. A school may have more than one stop, and the radius may need tuning after a week of data. Also, log the distance and the HDOP with each event; when a false arrival is reported, those values tell you whether the GPS or the fence was wrong.

## Uploading over GSM

The SIM800L supports HTTP and TCP. For a prototype, an HTTP POST to a small server is the easiest path. The payload should be compact, because GSM data is slow and you are paying for it:

```json
{
  "id": "bus-01",
  "ts": 1762089600,
  "lat": 11.2588,
  "lng": 75.7804,
  "spd": 32,
  "hdg": 145,
  "sat": 8,
  "hdop": 1.2,
  "bat": 3.92,
  "ign": 1
}
```

Use a device token in a header, not in the URL. A token in the URL ends up in server logs and proxy logs. If you use HTTPS, check that the module's TLS stack supports the server's certificate and cipher suite; older SIM800 firmware has limited TLS support and may fail on modern certificates. For a school project, a local server or an MQTT broker with TLS is often easier to secure than a public HTTP endpoint.

The upload loop should be non-blocking. The SIM800L can take several seconds to respond, and the GPS parser needs to keep running. Use a state machine or a separate task, and put a timeout on every network operation. If the upload fails, store the record in a ring buffer in LittleFS and retry later. Do not clear the buffer until the server acknowledges the write.

```cpp
struct TrackPoint {
  uint32_t ts;
  float lat, lng;
  uint16_t speed;
  uint8_t sats;
  float hdop;
};

// Keep the newest N points; drop the oldest when full.
```

A ring buffer of a few hundred points is enough for a day without coverage. Include a sequence number so the server can detect gaps and duplicates.

## Power budget and battery life

The ESP32 draws 80–240 mA depending on Wi-Fi and CPU load. The GPS draws about 50 mA. The SIM800L draws 20 mA idle but can peak at 2 A during a transmission. The average current depends on how often you upload.

A rough calculation: a 3.7 V 5000 mAh battery has about 18.5 Wh. If the average draw is 150 mA at 3.7 V, that is about 0.55 W, so the battery lasts around 33 hours. Add the SIM800L's peaks and the GPS, and a day of operation is realistic. If you need longer, use a larger battery, reduce the upload rate, or put the ESP32 into light sleep between fixes.

Do not put the GPS into a hard sleep if you need a fast fix; it will cold-start when it wakes. Some modules support a standby mode that keeps the ephemeris, which gives a much faster fix. Check the datasheet for your module.

The ignition sense is useful for saving power: when the bus is off, reduce the upload rate and put the ESP32 to sleep. But be careful not to lose the geofence state across a reboot. Store the last known state in NVS.

![IMAGE PLACEHOLDER: Battery and buck converter mounted in the tracker enclosure with the SIM800L capacitor](/images/gps-school-bus-tracking-image-02.jpg)

## Troubleshooting the tracker

### The GPS never gets a fix

Indoors, it will not. Take the antenna outside or near a window with a clear view of the sky. Check the antenna connection; the u.FL connector is fragile and can pop off. Check the module's power and the UART crossover: GPS TX goes to ESP32 RX. A cold start can take several minutes; a warm start with a backup battery is much faster.

If the module outputs NMEA sentences but the library reports no valid location, print the raw sentences. Look for `$GPGGA` with a fix quality of 1 or 2. A quality of 0 means no fix. If the sentences are garbled, check the baud rate and the ground connection.

### The SIM800L will not register on the network

The first suspect is power. The module needs a 4.0 V supply that can deliver 2 A surges. A USB port or a 3.3 V regulator will not do it. Measure the voltage at the module's power pins while it is trying to register; if it drops below 3.4 V, fix the supply before changing the code.

The second suspect is the antenna. The SIM800L needs a proper GSM antenna; a bare wire is not enough. The third is the SIM: check that it is activated, has credit, and does not have a PIN lock. The fourth is coverage: 2G may not be available in your area. If the module scans and finds nothing, that is a network problem, not a code problem.

### The ESP32 resets when the SIM800L transmits

This is the classic brownout. The 2 A surge pulls the supply down, and the ESP32 resets. Use a separate buck converter for the SIM800L, add a 1000 µF low-ESR capacitor, keep the power wires short and thick, and connect the grounds at a single point. Do not share the ESP32's 3.3 V rail with the GSM module.

### The position jumps around when the bus is stopped

GPS drift is normal, especially in an urban area. A stationary receiver can report a position that wanders by several metres. Use a speed threshold: if the reported speed is below 1 km/h for several fixes, treat the position as stationary and do not update the dashboard marker. Also, increase the HDOP threshold and use a median filter. Do not try to fix this with a tighter geofence; you will only create more false events.

### The server rejects the upload

Check the token, the content type, and the timestamp. A server that expects `application/json` will reject a form-encoded body. A token that expired will return 401. A timestamp in the past may be rejected by a replay protection rule. If you use HTTPS, check the certificate and the module's TLS support; a TLS handshake failure often looks like a generic network error.

## Privacy and responsible deployment

A school bus tracker collects location data about children. That is sensitive. The system should collect the minimum data needed, store it for a limited time, and restrict access to authorised staff. Do not publish live locations on a public dashboard. Do not keep historical routes longer than necessary. Tell parents what is collected and why, and give them a way to ask questions.

The device itself should not be hidden in a way that prevents inspection. A tracker that nobody knows about is a surveillance device, not a safety system. For a school project, use a model bus or a consenting adult's car, not a real school bus with real students.

## The demo and the extensions

The best indoor demo is a recorded NMEA playback. Record a real GPS log from a walk or a drive, then feed the sentences into the parser over a serial port. The dashboard moves along the recorded route, and the geofence events fire at the right places. That demonstrates the whole pipeline without needing a satellite fix in a exhibition hall.

Two extensions are worth considering. The first is a 4G module with a proper TLS stack, so the tracker can upload securely without a gateway. The second is an arrival prediction model that uses the bus's current position, speed, and historical travel times to estimate when it will reach the next stop. Both are real engineering problems, and both require careful handling of noisy data.

![IMAGE PLACEHOLDER: Dashboard showing the bus route, geofence circle, and arrival event log](/images/gps-school-bus-tracking-image-03.jpg)

The lesson I would take away is that a tracker is a data pipeline, not a GPS module. The fix is only the first step. The filtering, the power design, the retry logic, and the privacy policy are what make the difference between a demo and something you would trust with a real route.
