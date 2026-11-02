---
title: "Building a Smart Water Quality Monitor"
description: "An ESP32 water quality station using pH, TDS, turbidity, and temperature sensors, with calibration notes, an ADS1115 front end, and honest limits."
date: 2026-11-02
updated: 2026-11-02
author: "Ajmal Ali"
category: "Projects"
tags:
  - ESP32
  - Water-Quality
  - Sensors
  - IoT
  - Electronics
cover: "/images/blog/smart-water-quality-monitor/hero.jpg"
coverAlt: "ESP32 water quality monitor with pH, TDS, turbidity probes and a small display"
draft: false
---

Water quality is a topic where a cheap sensor can do more harm than good. A probe that reads pH 6.8 in a glass of tap water is not proof that the water is safe, and a TDS number without a temperature reading is only half a measurement. The project is still worth building, but it has to be framed correctly: it is a relative monitoring tool, not a certification instrument.

The station I would build for a school exhibition uses an ESP32, an ADS1115 analog-to-digital converter, a pH probe, a TDS probe, a turbidity sensor, and a DS18B20 temperature probe. It displays the readings locally and publishes them to a dashboard. The interesting engineering is not the wiring; it is the calibration, the signal conditioning, and the honesty about what the numbers mean.

## What each sensor actually measures

A pH probe is an electrochemical cell. The glass bulb develops a voltage that depends on the hydrogen ion activity, and the probe's high impedance makes the signal fragile. The voltage is small, the impedance is enormous, and the reading drifts if the probe is stored dry or contaminated. A pH probe is not a resistor; it is a living-ish sensor that needs care.

A TDS probe measures electrical conductivity and estimates total dissolved solids from it. The relationship depends on the composition of the water. A sodium chloride solution and a calcium carbonate solution can have the same conductivity but different TDS. The number is an estimate, usually calibrated against a standard solution and expressed as parts per million.

A turbidity sensor measures light scattered by suspended particles. It is good at detecting changes, such as sediment after rain or algae growth, but it is sensitive to bubbles, ambient light, and fouling. The output is usually a voltage that decreases as turbidity increases, and the conversion to NTU is approximate unless you calibrate it.

Temperature matters for all three. Conductivity changes with temperature, pH electrode response changes with temperature, and the biological processes you are trying to observe change with temperature. A DS18B20 is cheap, digital, and accurate enough for this application.

## Why the ESP32 needs an ADS1115

The ESP32's ADC is convenient but not precise. It is 12-bit, it is nonlinear near the rails, and it is noisy when Wi-Fi is active. For a pH probe that produces a small voltage swing, those limitations matter. The ADS1115 is a 16-bit I2C ADC with a programmable gain amplifier and a much cleaner front end. It is not laboratory-grade, but it is a big improvement for a few dollars.

The ADS1115 has four single-ended inputs. Use A0 for pH, A1 for turbidity, A2 for TDS, and leave A3 spare. Power the ADS1115 from 3.3 V and set the gain to ±4.096 V so the full-scale range covers the sensor outputs. The ADS1115's absolute input voltage must stay within its supply rails, so any sensor output above 3.3 V needs a divider.

That is the catch with the turbidity sensor. Many turbidity boards are powered from 5 V and output up to about 4.5 V in clear water. Feeding that directly into a 3.3 V ADS1115 will damage it or clamp the reading. Use a two-resistor divider to bring the output into range. A 10 kΩ / 10 kΩ divider halves the voltage, so 4.5 V becomes 2.25 V. The divider introduces a small error, but it is manageable if you use 1 percent resistors and calibrate the whole chain.

The pH board is usually powered from 5 V but outputs 0–3 V, which is safe for the ADS1115 at 3.3 V. The TDS board outputs 0–2.3 V, also safe. Check the datasheet for your specific boards; the cheap clones often change the output range without changing the silkscreen.

## Pin map and power

| Signal | ESP32 / ADS1115 | Notes |
| --- | --- | --- |
| ADS1115 SDA | GPIO 21 | I2C |
| ADS1115 SCL | GPIO 22 | I2C |
| ADS1115 ADDR | GND | Address 0x48 |
| pH output | ADS1115 A0 | 0–3 V typical |
| Turbidity output | ADS1115 A1 via divider | 0–4.5 V divided by 2 |
| TDS output | ADS1115 A2 | 0–2.3 V typical |
| Spare | ADS1115 A3 | Reserved |
| DS18B20 data | GPIO 4 | 4.7 kΩ pull-up to 3.3 V |
| OLED SDA | GPIO 21 | Optional, same bus |
| OLED SCL | GPIO 22 | Optional, same bus |
| Status LED | GPIO 2 | Optional |

Power the pH and turbidity boards from a clean 5 V supply, the TDS board from 3.3–5 V according to its label, and the ADS1115 and DS18B20 from 3.3 V. Connect all grounds together. Keep the analog wires short and away from the servo or pump wiring if you add one. A peristaltic pump is a noisy load, and its startup current can couple into the analog front end.

Do not immerse the connector or the board. Only the probe tips are waterproof. The pH board and the TDS board are not. If you are building a permanent installation, put the electronics in a sealed enclosure with cable glands, and keep the probes in a separate sampling chamber.

## Calibration is the project

A pH probe without calibration is a random number generator with a display. The probe's output changes with age, storage, and temperature, and the offset can drift by tens of millivolts. Calibrate with at least two buffer solutions, typically pH 4.00 and pH 7.00. If you are measuring alkaline water, add pH 10.00.

The procedure is simple but needs patience. Rinse the probe with distilled water, blot it gently with a lint-free tissue (do not wipe the glass bulb), and place it in the pH 7.00 buffer. Stir gently and wait for the reading to stabilise. Record the voltage. Repeat with pH 4.00. Then compute the slope and offset.

```cpp
struct PhCalibration {
  float v4;
  float v7;
};

float phFromVoltage(float v, const PhCalibration &cal) {
  float slope = (cal.v4 - cal.v7) / (4.0f - 7.0f);
  return 7.0f + (v - cal.v7) / slope;
}
```

Store the calibration values in NVS or LittleFS so they survive a reboot. Recalibrate every few weeks, or whenever the readings look implausible. A pH probe stored in distilled water will lose its reference electrolyte and drift; store it in the manufacturer's storage solution, or in a pH 4 buffer if you do not have one.

TDS calibration uses a standard solution, often 707 ppm or 1413 µS/cm. Rinse the probe, immerse it, and wait for the reading to settle. Adjust the calibration factor until the displayed value matches the standard. Temperature compensation is important: the common formula scales the voltage to 25 °C.

```cpp
float tdsFromVoltage(float voltage, float tempC) {
  float compensation = 1.0f + 0.02f * (tempC - 25.0f);
  float v = voltage / compensation;
  float tds = (133.42f * v * v * v
             - 255.86f * v * v
             + 857.39f * v) * 0.5f;
  return tds;
}
```

That polynomial is for the common DFRobot-style TDS board. It is an empirical fit, not a law of nature. If your board has a different output stage, the coefficients will be wrong. Calibrate against a standard and adjust, or fit your own curve from several standards.

Turbidity is the hardest to calibrate without formazin standards, which are not something I would keep in a school lab. For a relative project, measure clear water and a deliberately turbid sample, then map the voltage to a simple scale. If you need NTU, use a commercial standard and follow the manufacturer's procedure. Do not claim NTU accuracy from a two-point guess.

![IMAGE PLACEHOLDER: pH probe in a buffer solution during two-point calibration, with readings on the serial monitor](/images/smart-water-quality-monitor-image-01.jpg)

## Reading the sensors without lying to yourself

The ADS1115 library returns a raw value and a voltage. Use the voltage, but keep the raw value in the log for debugging. A reading that is pinned at full scale or zero is usually a wiring or gain problem, not a real measurement.

```cpp
#include <Adafruit_ADS1X15.h>
#include <OneWire.h>
#include <DallasTemperature.h>

Adafruit_ADS1115 ads;
OneWire oneWire(4);
DallasTemperature ds18b20(&oneWire);

void setupSensors() {
  Wire.begin(21, 22);
  ads.setGain(GAIN_ONE);      // ±4.096 V
  if (!ads.begin(0x48)) {
    Serial.println("ADS1115 not found");
  }
  ds18b20.begin();
}

float readChannelVolts(uint8_t ch) {
  int16_t raw = ads.readADC_SingleEnded(ch);
  return ads.computeVolts(raw);
}
```

Take several samples and use the median or a trimmed mean. A single sample is vulnerable to a noise spike from the Wi-Fi radio or a nearby pump. Five to nine samples over a few hundred milliseconds is enough for a water-quality station that updates every few seconds.

The DS18B20 needs a 4.7 kΩ pull-up from the data line to 3.3 V. If you use a long cable, lower the pull-up to 2.2 kΩ or use a dedicated 1-Wire driver. If the sensor returns −127 °C, the bus is not responding; check the pull-up, the wiring, and the address.

## Sampling, storage, and the dashboard

A water-quality station is only as good as its sampling routine. Rinse the probes with distilled water between samples, and do not let the pH and TDS probes share the same small container while both are powered. The pH probe's output can be affected by the conductivity probe's excitation, and the TDS reading can be affected by the pH probe's reference. For a school demo, measure them in separate cups or power one at a time.

Log the raw voltages, the computed values, the temperature, and a timestamp. If the station is online, publish a JSON payload over MQTT:

```json
{
  "device": "water-station-1",
  "ts": 1762089600,
  "ph": 7.12,
  "tds_ppm": 184,
  "turbidity_ntu": 12.4,
  "temp_c": 24.6,
  "raw": { "ph_v": 1.842, "tds_v": 0.912, "turb_v": 3.41 }
}
```

The raw values are what let you debug a bad reading later. If the pH says 9.4 but the raw voltage is unchanged from yesterday, the calibration or the probe is the problem, not the water. If the raw voltage moved and the computed value did not, the conversion is the problem.

For a dashboard, plot the values over time and include the calibration date. A reading without a calibration date is hard to trust. If the station is deployed outdoors, add a battery voltage channel and a enclosure temperature channel; both explain a lot of strange data.

![IMAGE PLACEHOLDER: Dashboard showing pH, TDS, turbidity, and temperature trends over a day](/images/smart-water-quality-monitor-image-02.jpg)

## Troubleshooting the station

### The pH reading drifts or sits at 0 or 14

A drifting pH reading is usually a probe problem, not a code problem. Check the probe's storage: if it has been sitting dry, the glass bulb may need to rehydrate in storage solution for a few hours. Check the connector for moisture. Check the calibration values; a bad pH 4.00 reading will produce a slope that sends every subsequent measurement off the scale.

If the reading is pinned at 0 or 14, the ADS1115 may be saturating. Check the gain, the probe's output voltage, and the ground connection. A missing ground between the pH board and the ADS1115 can produce a reading that looks plausible but is nonsense.

### The TDS reading is always zero

The TDS probe needs to be immersed above the electrode area, not just touching the surface. It also needs the temperature reading to compensate. If the temperature sensor fails and returns −127 °C, the compensation formula can produce a negative or zero result. Check the DS18B20 first, then the TDS probe's power and output.

If the TDS value is plausible but far from the standard, the calibration factor is wrong. Adjust it against a standard solution, and make sure the probe is clean. Oil or biofilm on the electrodes lowers the conductivity and makes the water look purer than it is.

### The turbidity reading is noisy or pinned

Bubbles are the usual culprit. Let the sample sit for a minute before reading, or tap the probe gently to dislodge bubbles. Ambient light can also leak into the sensor; use a opaque sampling chamber or shield the probe. If the reading is pinned at full scale, the divider may be wrong or the sensor may be receiving more than 3.3 V at the ADS1115 input.

### The DS18B20 returns −127 °C

The bus is not responding. Check the 4.7 kΩ pull-up, the data pin, and the ground. If you have several sensors on the bus, check for address conflicts. A long cable with a weak pull-up will work intermittently, which is worse than failing outright.

### The readings change when the Wi-Fi connects

This is the ESP32 ADC's noise floor, and it is one reason to use the ADS1115. Keep the analog wires short, add a 0.1 µF capacitor at the ADS1115 supply, and avoid running the analog lines next to the antenna. If you are still using the internal ADC for anything, take the reading when Wi-Fi is idle or average many samples.

## What the project teaches

The strongest exhibition demo is a comparison, not a single reading. Test tap water, rain water, and pond water, and show how the values differ. Then show what happens when you add a pinch of salt to the TDS sample, or a little sediment to the turbidity sample. The sensors respond, and the audience sees that the numbers are connected to physical properties.

The real-world problem is water safety, which is serious. Make it clear that this station is not a certified laboratory test and must not be used to decide whether water is safe to drink. The project is a monitoring and education tool. That honesty is part of the engineering.

Two extensions are worth considering. The first is a GPS-tagged mobile station for mapping water sources in a community. The second is a solar-powered node with LoRa backhaul for a pond or a stream, where Wi-Fi does not reach. Both require rugged enclosures, probe maintenance, and a calibration schedule, which is exactly what real environmental monitoring involves.

![IMAGE PLACEHOLDER: Water samples from tap, rain, and pond being compared with the sensor station](/images/smart-water-quality-monitor-image-03.jpg)

The lesson I keep coming back to is that the probe is only half the instrument. The other half is the calibration, the sampling procedure, and the willingness to say "I do not know" when the reading is outside the range the sensor can support. A water-quality station that displays a confident number it cannot justify is worse than no station at all.
