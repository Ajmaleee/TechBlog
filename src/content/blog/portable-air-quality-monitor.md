---
title: "Building a Portable Air Quality Monitoring Station"
description: "An ESP32 air quality monitor using PMS5003, BME280, and an OLED, with honest notes on particulate measurements, UART parsing, and live dashboards."
date: 2026-11-02
updated: 2026-11-02
author: "Ajmal Ali"
category: "Projects"
tags:
  - ESP32
  - Air-Quality
  - Sensors
  - IoT
  - Electronics
cover: "/images/blog/portable-air-quality-monitor/hero.jpg"
coverAlt: "Portable ESP32 air quality monitor with PMS5003 particulate sensor, BME280, and OLED display"
draft: false
---

Air quality is one of those things that is easy to measure badly. You can buy a sensor, print a number on an OLED, and call it a day, but the number will be wrong in interesting ways depending on humidity, airflow, warm-up time, and which particular particle size the sensor is estimating. Building a portable station is a good excuse to learn where those errors come from.

The version I would take to a science fair uses an ESP32, a PMS5003 laser particulate sensor, a BME280 for temperature, humidity, and pressure, and a small OLED. It logs PM1.0, PM2.5, and PM10, shows the values locally, and publishes them to a dashboard over Wi-Fi. It is portable enough to carry between classrooms, and it is honest enough to say "this is an estimate" rather than "this is a certified measurement".

## What PM2.5 actually means

Particulate matter is a mixture, not a single substance. PM2.5 refers to particles with an aerodynamic diameter of roughly 2.5 micrometres or less. PM10 includes larger particles up to about 10 micrometres. The smaller particles matter because they can travel deeper into the respiratory system, which is why public health guidance focuses on them.

The PMS5003 is a laser scattering sensor. A fan pulls air through a chamber, a laser illuminates the particles, and a photodiode measures the scattered light. The sensor's firmware converts that signal into mass concentration estimates and particle counts. It is not a gravimetric reference monitor. It does not weigh the particles, and its calibration is based on a particular aerosol. Humidity can make particles look larger, and different particle compositions scatter light differently.

That does not make it useless. It makes it a good relative instrument. If the reading goes from 8 to 80 µg/m³ when someone sprays deodorant in the room, the sensor is telling you something real. If it disagrees with a reference monitor by 30 percent, that is also normal. The mistake is claiming more precision than the device can support.

## Hardware and wiring

The PMS5003 needs 5 V and draws a peak current of around 100 mA when the fan and laser are running. Its UART logic is usually 3.3 V, but check the variant. Some modules are 5 V logic and need a level shifter or a divider on the TX line going into the ESP32. The BME280 is a 3.3 V I2C device, and the OLED is also I2C.

| Signal | ESP32 pin | Notes |
| --- | --- | --- |
| PMS5003 VCC | 5 V | From a stable 5 V supply, not the 3.3 V pin |
| PMS5003 GND | GND | Common ground |
| PMS5003 TX | GPIO 16 | ESP32 UART2 RX |
| PMS5003 RX | GPIO 17 | ESP32 UART2 TX |
| PMS5003 SET/RST | GPIO 25 | Optional; leave floating if unused |
| BME280 SDA | GPIO 21 | I2C |
| BME280 SCL | GPIO 22 | I2C |
| OLED SDA | GPIO 21 | Same bus |
| OLED SCL | GPIO 22 | Same bus |
| Page button | GPIO 27 | Optional, input with pull-up |

The PMS5003's connector is a 1.25 mm pitch JST-style header on many modules, and the pin order is not standardized across every breakout board. Read the label on the board, not the label on the cable. Reversing VCC and GND is a quick way to destroy the sensor and, if you are unlucky, the ESP32.

Power the PMS5003 from a 5 V rail that can actually deliver the current. A weak USB port that sags when the Wi-Fi radio transmits will cause the fan speed to drop, and the readings will drift. Put a 100 µF capacitor near the sensor's connector if the supply is marginal.

## Reading the PMS5003 without blocking

The PMS5003 sends a 32-byte frame at 9600 baud. The frame starts with the bytes 0x42 and 0x4D, followed by a two-byte length, then thirteen 16-bit values, then a two-byte checksum. The checksum is the sum of the first 30 bytes. If the checksum does not match, throw the frame away.

A blocking `while (!Serial2.available())` loop is a bad idea because it stops the rest of the firmware. A small state machine is better:

```cpp
struct PmsReading {
  uint16_t pm1_cf1;
  uint16_t pm25_cf1;
  uint16_t pm10_cf1;
  uint16_t pm1_atm;
  uint16_t pm25_atm;
  uint16_t pm10_atm;
  bool valid;
};

PmsReading readPms() {
  static uint8_t buf[32];
  static uint8_t idx = 0;
  PmsReading out{};

  while (Serial2.available()) {
    uint8_t b = Serial2.read();

    if (idx == 0 && b != 0x42) continue;
    if (idx == 1 && b != 0x4D) { idx = 0; continue; }

    buf[idx++] = b;
    if (idx < 32) continue;

    uint16_t sum = 0;
    for (int i = 0; i < 30; i++) sum += buf[i];
    uint16_t expected = (buf[30] << 8) | buf[31];

    if (sum == expected) {
      out.pm1_cf1  = (buf[4]  << 8) | buf[5];
      out.pm25_cf1 = (buf[6]  << 8) | buf[7];
      out.pm10_cf1 = (buf[8]  << 8) | buf[9];
      out.pm1_atm  = (buf[10] << 8) | buf[11];
      out.pm25_atm = (buf[12] << 8) | buf[13];
      out.pm10_atm = (buf[14] << 8) | buf[15];
      out.valid = true;
    }
    idx = 0;
  }
  return out;
}
```

The "CF=1" values are the factory calibration values, while the "atmospheric" values are intended to approximate the ambient concentration. For most hobby dashboards, the atmospheric values are the ones to show. Print both during development and see how they differ; the gap tells you something about the sensor's internal model.

The BME280 is much easier. Use the Adafruit library, initialise it at 0x76 or 0x77, and read temperature, humidity, and pressure. It is not a CO2 sensor. If you want CO2, use an NDIR sensor such as the MH-Z19 or a photoacoustic sensor such as the SCD40, and expect to pay more. Do not infer CO2 from temperature and humidity; that is not a measurement, it is a guess dressed up as one.

## From raw numbers to something readable

The OLED should show the numbers a person can act on: PM2.5, PM10, temperature, humidity, and a simple status word. A raw particle count is useful for debugging but meaningless to most viewers.

A basic air quality index can be computed from PM2.5 using the EPA breakpoints. The formula is a piecewise linear interpolation:

```cpp
int pm25ToAqi(float pm) {
  struct Break { float cLow, cHigh; int iLow, iHigh; };
  static const Break table[] = {
    {0.0, 12.0, 0, 50},
    {12.1, 35.4, 51, 100},
    {35.5, 55.4, 101, 150},
    {55.5, 150.4, 151, 200},
    {150.5, 250.4, 201, 300},
    {250.5, 500.4, 301, 500},
  };
  for (const auto &b : table) {
    if (pm <= b.cHigh) {
      float ratio = (pm - b.cLow) / (b.cHigh - b.cLow);
      return int(b.iLow + ratio * (b.iHigh - b.iLow) + 0.5);
    }
  }
  return 500;
}
```

AQI is a communication tool, not a physical quantity, and different countries use different breakpoints. If you publish an AQI, say which standard you used. Otherwise, two dashboards can show different numbers for the same air and both be "right" within their own rules.

![IMAGE PLACEHOLDER: OLED display showing PM2.5, PM10, temperature, humidity, and a simple status label](/images/portable-air-quality-monitor-image-01.jpg)

## The dashboard and the data pipeline

For a portable station, Wi-Fi is convenient but not always available. The firmware should keep measuring and displaying even when the network is down. Buffer the last few hundred readings in LittleFS and upload them when the connection returns. Do not block the sensor loop while waiting for Wi-Fi; that is how you end up with gaps in the data and a fan that keeps running for no reason.

A simple MQTT payload every thirty seconds is enough:

```json
{
  "device": "aqi-station-1",
  "ts": 1762089600,
  "pm1": 6,
  "pm25": 9,
  "pm10": 14,
  "temp_c": 27.4,
  "rh": 58.2,
  "pressure_hpa": 1008.6,
  "aqi": 38
}
```

Use NTP to get a real timestamp, or let the broker add one. A reading without a timestamp is nearly useless when you are trying to correlate it with an event. If the station is truly offline, store the ESP32's uptime and the last known time, and correct it later rather than pretending the clock is accurate.

For visualization, Grafana with InfluxDB or a simple Chart.js page is more than enough. The important design choice is to keep the raw PM values alongside any AQI. If someone questions the AQI, you can show the underlying measurement and the conversion table.

## Calibration and honest testing

You cannot calibrate a PMS5003 with a plastic bag and a cigarette. You can, however, do a few useful things. Let the sensor run for a few minutes before trusting the numbers; the fan and laser need to stabilise. Keep the intake clear and avoid placing the station near a wall that reflects particles back into the inlet. Measure in the same spot for a while before comparing two sensors, because air quality changes quickly.

If you have access to a reference monitor, co-locate the sensors and record both for an hour. Plot the relationship instead of adjusting a single offset. Humidity correction is a real research topic; a simple linear correction is better than nothing but not a substitute for a proper calibration.

For a school demo, compare indoor and outdoor air, or measure the decay of particles after a source is removed. Incense or a candle produces a lot of particles, but do it in a ventilated space with supervision, and do not leave it burning. The point is to show the sensor responding to a real change, not to create a health hazard in the name of science.

![IMAGE PLACEHOLDER: Dashboard chart showing PM2.5 rising during an indoor source and falling after ventilation](/images/portable-air-quality-monitor-image-02.jpg)

## Troubleshooting the station

### The PMS5003 sends nothing

The first thing to check is the UART crossover: the sensor's TX goes to the ESP32's RX, and the sensor's RX goes to the ESP32's TX. The second is the baud rate, which is 9600 for the standard PMS5003. The third is power. A 5 V supply that cannot deliver the fan current will produce a sensor that starts and then resets, or one that never sends a complete frame.

If you see bytes but the checksum always fails, you may be reading the wrong UART pins or mixing two frames. Print the raw bytes in hexadecimal for a few seconds. A valid frame starts with `42 4D` and has a length field of `00 1C`. If you see `42 4D` but the length is nonsense, the sensor is probably being reset mid-frame by a power dip.

### The readings sit at zero

A PMS5003 that reports zero for everything is often in a clean room with no particles, but it can also be a sensor that is not running. Check the fan: you should be able to hear or feel it. If the fan is off, the 5 V supply or the SET/RST pin is the problem. If the fan is running and the readings are still zero, the laser may be blocked or the sensor may need replacement.

### The values jump around wildly

Airflow is the usual culprit. The fan pulls air through a small chamber, so a draft from an open window or a nearby person can change the reading. Mount the sensor so the intake is not facing a direct draft, and average several frames before displaying a value. A median over five frames is a good compromise between responsiveness and stability.

### The BME280 is not detected

Run an I2C scanner. The BME280 is usually at 0x76 or 0x77, and the OLED is usually at 0x3C. If neither appears, check SDA/SCL, the 3.3 V supply, and the pull-up resistors. Some BME280 breakout boards have a voltage regulator and level shifters; others do not. Powering a bare sensor from 5 V is a good way to make it disappear permanently.

### The ESP32 resets when the fan starts

This is the same brownout story as every motor project. The fan's startup current pulls the 5 V rail down, and the ESP32's regulator loses regulation. Use a supply with more headroom, add bulk capacitance, and keep the sensor's power wires separate from the ESP32's supply until they meet at the regulator. If you are powering everything from a USB power bank, check its current rating; many are more optimistic on the label than in reality.

## Presenting the project

The strongest demonstration is a before-and-after measurement. Put the station in a closed room, let it settle, then introduce a controlled particle source and watch the numbers rise. Ventilate the room and watch them fall. The graph is the story: the sensor is not just producing numbers, it is showing a physical process.

The real-world problem is that air quality is often invisible. A portable station makes it visible and gives you a reason to talk about sensor limitations, calibration, and the difference between a measurement and an estimate. That is a more mature story than "my sensor says 12".

Two extensions are worth considering. The first is a GPS-tagged mobile station that maps particulate levels along a route. The second is a multi-node network with one indoor and one outdoor sensor, so you can compare infiltration and ventilation. Both require careful timestamping and calibration, which is exactly the kind of work that turns a demo into a project.

![IMAGE PLACEHOLDER: Portable station in its enclosure with the sensor intake, OLED, and power bank visible](/images/portable-air-quality-monitor-image-03.jpg)

The lesson I would take away is that a sensor is not a measurement until you understand its error bars. The PMS5003 is a genuinely useful device for relative comparisons, and the BME280 is a solid environmental sensor. But the moment you put a number on a dashboard, someone will treat it as truth. Label the units, state the standard, and keep the raw data. That is what separates an engineering project from a display of random numbers.
