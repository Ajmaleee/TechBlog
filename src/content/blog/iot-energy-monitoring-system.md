---
title: "Building an IoT Energy Monitoring System"
description: "Track voltage, current, and power with an INA219, log energy to a dashboard, and learn the difference between power and energy with safe, low-voltage practice."
date: 2026-11-02
updated: 2026-11-02
author: "Ajmal Ali"
category: "Projects"
tags:
  - ESP32
  - Energy
  - INA219
  - IoT
  - Electronics
cover: "/images/blog/iot-energy-monitoring-system/hero.jpg"
coverAlt: "ESP32 energy monitor with INA219, OLED display, and a small load showing power readings"
draft: false
---

Energy monitoring is one of the most practical IoT projects. If you can measure how much power something uses, you can compare devices, find waste, and estimate costs. The project is also a good lesson in the difference between power and energy: watts are instantaneous, watt-hours are accumulated. A device that draws 5 W for an hour uses 5 Wh, not 5 W.

The version I would build uses an ESP32, an INA219 high-side current sensor, an OLED display, and a dashboard over Wi-Fi. The important constraint is safety: this is a low-voltage DC project, not a mains energy monitor. Mains monitoring requires isolation, certified hardware, and knowledge of electrical codes. Do not touch mains voltage for a school project.

## Power versus energy

Power is voltage times current, measured in watts. At any moment, P = V × I. Energy is power over time, measured in watt-hours or joules. If you sample power every minute and sum P × Δt, you get energy. The accuracy of that integral depends on the sampling rate and how constant the load is.

A resistor load is constant. A phone charger is not constant; it has switching stages and a pulsing load. A motor ramps up, stalls, and runs at different loads. For those cases, you need enough samples to capture the variation. A minute is fine for a steady load, but it is too coarse for a switching supply.

The INA219 measures bus voltage and shunt voltage, computes current, and can compute power internally. Trust but verify: the power register is computed from the current and bus voltage, so if either is wrong, the power is wrong. Log the raw bus voltage, shunt voltage, and current so you can recompute everything if needed.

## Hardware and safe design

The INA219 is a bidirectional current/power monitor with an I2C interface. The breakout boards usually have a 0.1 Ω shunt resistor. Place the INA219 on the high side of the load: connect the power supply's positive terminal to VIN+, the load's positive terminal to VIN−, and connect the grounds together. The low side is also possible, but the high side is safer for some applications and avoids ground shift issues.

| Signal | ESP32 pin | Notes |
| --- | --- | --- |
| INA219 SDA | GPIO 21 | I2C |
| INA219 SCL | GPIO 22 | I2C |
| INA219 VCC | 3.3 V | Power the breakout |
| Power supply | 5–12 V DC | Keep low voltage |
| Load | Resistor, LED, fan, etc. | Observe ratings |
| OLED SDA | GPIO 21 | Optional, same bus |
| OLED SCL | GPIO 22 | Optional, same bus |
| Voltage divider sense | GPIO 34 | Optional for higher voltages |
| Status LED | GPIO 2 | Optional |

The INA219 is rated for up to 26 V and about 3.2 A with the default shunt. If you exceed those values, the shunt will overheat or the sensor will give incorrect readings. For a 12 V 5 A load, you need a larger shunt or a different sensor. Do not improvise with mains voltages.

For loads above 3.2 A, you can replace the shunt resistor with a lower value, but that reduces the voltage across the shunt and makes the measurement noisier. A better solution is to use a dedicated current sensor, such as the ACS712 Hall-effect sensor, which is isolated in some variants but still not rated for safe mains isolation without proper design.

Keep the wires short, especially the shunt connections. The INA219 measures a small voltage across the shunt (a few millivolts at full scale), so any resistance in the sense wires adds error. Use Kelvin connections if possible, or just keep the sense wires separate from the power wires.

![IMAGE PLACEHOLDER: INA219 wired in high-side configuration with a 5V supply, a resistor load, and an ESP32](/images/iot-energy-monitoring-system-image-01.jpg)

## Reading and calibrating the INA219

Initialize the sensor and calibrate it for your shunt. The default calibration is for a 0.1 Ω shunt and 32 V, 2 A range, but it is worth verifying:

```cpp
#include <Adafruit_INA219.h>

Adafruit_INA219 ina219(0x40);

void setupPower() {
  if (!ina219.begin()) {
    Serial.println("INA219 not found");
    while (1) delay(1000);
  }
  // Default is fine for 0.1 ohm shunt, but you can set explicitly
  // ina219.setCalibration_32V_2A();
}

struct Reading {
  float busV;
  float shuntV;
  float currentA;
  float powerW;
  float loadV;
};

Reading readAll() {
  Reading r;
  r.busV = ina219.getBusVoltage_V();
  r.shuntV = ina219.getShuntVoltage_mV() / 1000.0f;
  r.currentA = ina219.getCurrent_mA() / 1000.0f;
  r.powerW = ina219.getPower_mW() / 1000.0f;
  r.loadV = r.busV + r.shuntV; // or busV alone depending on placement
  return r;
}
```

Check the calibration with a known load. A 10 Ω resistor at 5 V should draw 0.5 A and dissipate 2.5 W. The INA219 should report values close to that. If the current is off by more than a few percent, check the shunt value or the calibration. Cheap breakout boards sometimes have shunts that are not exactly 0.1 Ω.

The load voltage can be calculated as bus voltage plus shunt voltage on the high side, or bus voltage alone depending on where you measure. With the standard breakout, VIN− is the load side and the bus voltage is measured relative to GND on the high side, so `loadV = busV` is often the value you want. Check the datasheet for your board.

## Energy accumulation and storage

To compute energy, integrate power over time. Use `millis()` for the interval, and store the energy in watt-hours or joules. Watt-hours are easier to think about for billing; joules are SI units.

```cpp
float energyWh = 0.0f;
uint32_t lastMs = 0;

void updateEnergy() {
  if (lastMs == 0) {
    lastMs = millis();
    return;
  }
  uint32_t now = millis();
  uint32_t dtMs = now - lastMs;
  lastMs = now;
  
  float dtH = dtMs / 3600000.0f;
  Reading r = readAll();
  energyWh += r.powerW * dtH;
}
```

Save the energy value periodically to NVS or LittleFS so a power loss does not reset the counter to zero. If you need a non-resettable energy counter, store it in EEPROM with a wear-leveling strategy, but for a project it is fine to store it every minute and restore it on boot. The counter will be off by the energy used between the last save and the power loss, which is usually small.

For a dashboard, report both instantaneous power and cumulative energy. Also track the peak power, the average power, and the runtime. A phone charger might draw 0 W when not connected, 5 W while charging, and drop to 1 W when topped up; seeing those patterns is interesting.

![IMAGE PLACEHOLDER: OLED display showing voltage, current, power, and accumulated energy in watt-hours](/images/iot-energy-monitoring-system-image-01b.jpg)

## The dashboard and data pipeline

Send readings to a server every 10-30 seconds. A shorter interval gives better resolution but uses more bandwidth and power. A longer interval is fine for slow-changing loads. Include a timestamp from NTP:

```json
{
  "device": "energy-monitor-1",
  "ts": 1762089600,
  "bus_v": 5.02,
  "current_a": 0.498,
  "power_w": 2.50,
  "energy_wh": 12.4,
  "load_v": 5.01
}
```

Store the data in a time-series database like InfluxDB, or a simple database and plot with Chart.js. The key is to keep the data long enough to see trends, but not so long that storage becomes an issue. A month of 30-second readings is about 86,000 points per device, which is trivial for modern databases.

Add a simple cost estimator if you know the local electricity rate. Let the user enter the rate in kWh, and compute the estimated cost for the day, the week, and the month. That makes the project more relatable, but be explicit that it is an estimate based on the measured DC consumption, not the actual utility bill.

## Troubleshooting the monitor

### The readings are all zero

Check the wiring first. The INA219 must be powered from 3.3 V, and the I2C lines must be connected. Run an I2C scanner to confirm the address (usually 0x40). If the scanner finds it but the readings are zero, the load may not be connected, or the INA219 may be wired on the wrong side. Check that current is actually flowing.

### The current reads negative

The INA219 is bidirectional. If the current flows in the opposite direction to what the sensor expects, the reading will be negative. Swap the VIN+ and VIN− connections, or just take the absolute value in software. For a simple DC load powered from a supply, the direction should be fixed.

### The power reading seems off

Check the shunt voltage. If the shunt voltage is very small, the measurement is noisy. If the shunt voltage is near the maximum, the sensor may be saturated. Verify the calibration with a known load and a multimeter. A cheap multimeter and the INA219 will probably not agree to the third decimal place; differences of a few percent are normal.

Also check that the bus voltage is being measured correctly. If the supply voltage sags under load, the INA219 should see it, but if there is resistance in the wires, the reading may not match a meter placed directly across the supply terminals.

### The ESP32 resets or the display flickers

The INA219 draws very little current, but the load might be drawing more than the power supply can provide. A weak USB port or a cheap wall adapter may sag. Use a proper bench supply or a supply rated for the load. If the flicker only happens when the load changes, it is a power supply transient; add bulk capacitance.

### The I2C bus conflicts with other devices

The INA219 and OLED can share the same I2C bus if they have different addresses. The INA219 is usually 0x40, and the OLED is usually 0x3C. If they conflict, change the INA219's address by bridging the A0 pin, or put them on separate buses. Check for address conflicts with an I2C scanner.

## Safety warning

I need to say this clearly: do not use this project to monitor mains AC power. Mains voltages are lethal. There are purpose-built energy monitors with proper isolation for that use case, and they are the only safe option. This project is strictly for low-voltage DC circuits.

Even with DC, be careful with high currents. A short circuit can start a fire. Use fuses or circuit breakers sized for your load, and never leave a high-current test unattended. Keep flammable materials away from power resistors, because they can get hot enough to burn.

## The demo and what it teaches

A great demo is to measure several common chargers or devices and compare their power consumption. A phone charger might draw 0.1 W on standby and 10 W while charging. An LED strip might draw 6 W. A small fan might draw 2 W. The numbers often surprise people.

The educational value is the difference between power and energy. A device can be efficient (low watts) but used for a long time (high watt-hours). A device can be inefficient but used briefly. Showing both numbers and computing a cost makes the concept concrete.

Two extensions are worth considering. The first is solar panel monitoring: track the panel's output and the battery's charge to build a simple energy balance. The second is home automation integration: trigger a smart plug or send an alert when a device has been on for too long or is drawing more power than expected. Both are practical, but again, stay on the DC side.

![IMAGE PLACEHOLDER: Dashboard chart showing power consumption over time for different loads](/images/iot-energy-monitoring-system-image-02.jpg)

The lesson I would take away is that measurement changes behaviour. Once you see how much power a device actually uses, you start making different choices. A good energy monitor does not just collect data; it makes the data visible and understandable. That is the real value of the project.
