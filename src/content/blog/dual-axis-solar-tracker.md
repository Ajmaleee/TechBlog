---
title: "Making a Dual-Axis Solar Tracking System"
description: "Build an ESP32 dual-axis solar tracker with an LDR array, servos, and INA219 measurements, then compare its energy output against a fixed panel."
date: 2026-11-02
updated: 2026-11-02
author: "Ajmal Ali"
category: "Projects"
tags:
  - ESP32
  - Solar
  - Electronics
  - Arduino
  - Sensors
cover: "/images/blog/dual-axis-solar-tracker/hero.jpg"
coverAlt: "Dual-axis solar tracker prototype with a small solar panel, LDR array, and two servos"
draft: false
---

A solar tracker is a mechanical answer to a geometric problem. A fixed panel is only perpendicular to the sun for a moment, and for the rest of the day the light arrives at an angle. A tracker follows the sun so the panel stays closer to perpendicular, which sounds like free energy until you account for the motors, the mechanics, and the fact that a cloudy day does not care about your control algorithm.

The project is still worth building, because it combines optics, control theory, mechanics, and energy measurement in one tabletop object. The version I would build uses four light-dependent resistors in a cross, two servos for pan and tilt, a small solar panel, and an INA219 current/voltage sensor so the comparison with a fixed panel is based on data rather than optimism.

## The geometry, without the trigonometry

The sun's position has two components that matter here: azimuth, which is roughly east-to-west across the sky, and elevation, which is how high it is above the horizon. A dual-axis tracker moves in both. A single-axis tracker usually follows azimuth only and leaves the panel at a fixed tilt.

For a small panel, a dual-axis mount is a pan servo at the base and a tilt servo on the moving frame. The panel sits on the tilt frame. The LDR array is mounted in the same plane as the panel, with a small opaque cross between the sensors so each LDR sees a different part of the sky. When the panel is aimed at the sun, all four LDRs receive roughly the same amount of light. When it is off-axis, one side is brighter, and the controller nudges the servos until the difference falls inside a deadband.

That is the whole algorithm. The hard part is making it stable. A controller that reacts to every small difference will oscillate, buzz the servos, and waste more energy than it collects. A controller with a large deadband will be stable but inaccurate. The useful middle ground is a deadband of a few tens of millivolts, a slow update rate, and a mechanical design that does not fight itself.

## Parts and the choices that matter

The LDR is cheap and slow. Its resistance falls as light increases, and it has a memory effect: after being exposed to bright light, it takes a moment to settle. That is fine for a tracker that updates a few times per second. It is not fine for a precision instrument.

The servo is the limiting component. An SG90 is fine for a tiny panel, but it has plastic gears, limited torque, and a tendency to jitter under load. An MG996R has metal gears and more torque, but it draws more current and needs a proper supply. For a panel larger than a phone, use a geared motor with a driver or a worm gear, not a hobby servo.

The INA219 is a high-side current and voltage monitor. It measures the bus voltage and the voltage across a shunt resistor, then calculates current. The common breakout board has a 0.1 Ω shunt and is rated to about 26 V and 3.2 A. For a small 6 V panel, that is plenty. It is not a substitute for a proper energy meter, but it is good enough to compare two panels under the same conditions.

| Component | Recommendation | Notes |
| --- | --- | --- |
| Controller | ESP32 DevKit | Wi-Fi logging, ADC, PWM |
| Light sensor | 4x LDR (GL5528 or similar) | Matched where possible |
| Servos | 2x SG90 for a small panel, MG996R for a bigger one | Separate 5–6 V supply |
| Panel | 5–6 V, 1–5 W | Keep the demo low voltage |
| Sensor | INA219 breakout | High-side measurement |
| Frame | 3D-printed or laser-cut bracket with bearings | Avoid servo as a structural bearing |
| Display | Optional OLED | Local readout |

## Wiring and pin map

The ESP32's ADC1 pins are the safe choice for analog sensors when Wi-Fi is active. GPIO 34–39 are input-only, which is fine for the LDR dividers. The servos can use almost any output-capable pin, but keep them away from the strapping pins and the ADC pins you are using.

| Signal | ESP32 pin | Notes |
| --- | --- | --- |
| LDR left | GPIO 34 | ADC1, input-only |
| LDR right | GPIO 35 | ADC1, input-only |
| LDR top | GPIO 32 | ADC1 |
| LDR bottom | GPIO 33 | ADC1 |
| Pan servo | GPIO 18 | PWM |
| Tilt servo | GPIO 19 | PWM |
| INA219 SDA | GPIO 21 | I2C |
| INA219 SCL | GPIO 22 | I2C |
| Optional OLED SDA | GPIO 21 | Same bus |
| Optional OLED SCL | GPIO 22 | Same bus |

Each LDR needs a voltage divider. Connect the LDR between 3.3 V and the ADC pin, and a 10 kΩ resistor from the ADC pin to ground. In bright light the LDR resistance is low, so the ADC voltage is high; in darkness it is low. The exact resistor value is a compromise: a higher value gives more sensitivity in dim light but saturates sooner in bright light. For outdoor use, 10 kΩ is a reasonable starting point.

Do not power the servos from the ESP32's 5 V pin. Use a separate 5–6 V supply rated for at least 2 A, connect the grounds, and put a 1000 µF capacitor across the servo supply. If the servos twitch when they start, the supply is sagging. If the ESP32 resets when the servos move, the supply is sagging a lot.

![IMAGE PLACEHOLDER: Wiring diagram for four LDR dividers, two servos, INA219, and the ESP32](/images/dual-axis-solar-tracker-image-01.jpg)

## The tracking algorithm

The controller reads the four LDRs, computes the left-right and top-bottom differences, and moves the servos in small steps. The key is to move only when the difference is larger than the deadband, and to move by a small amount rather than jumping to a computed angle.

```cpp
constexpr int PAN_PIN = 18;
constexpr int TILT_PIN = 19;
constexpr int LDR_L = 34, LDR_R = 35, LDR_T = 32, LDR_B = 33;
constexpr int DEADBAND_MV = 60;
constexpr int STEP_DEG = 2;
constexpr int PAN_MIN = 10, PAN_MAX = 170;
constexpr int TILT_MIN = 20, TILT_MAX = 160;

Servo panServo, tiltServo;
int panAngle = 90, tiltAngle = 90;

int readLdr(int pin) {
  const int n = 7;
  int v[n];
  for (int i = 0; i < n; i++) {
    v[i] = analogReadMilliVolts(pin);
    delay(3);
  }
  std::sort(v, v + n);
  return v[n / 2];
}

void track() {
  int left  = readLdr(LDR_L);
  int right = readLdr(LDR_R);
  int top   = readLdr(LDR_T);
  int bottom = readLdr(LDR_B);

  if (left - right > DEADBAND_MV) panAngle -= STEP_DEG;
  else if (right - left > DEADBAND_MV) panAngle += STEP_DEG;

  if (top - bottom > DEADBAND_MV) tiltAngle += STEP_DEG;
  else if (bottom - top > DEADBAND_MV) tiltAngle -= STEP_DEG;

  panAngle = constrain(panAngle, PAN_MIN, PAN_MAX);
  tiltAngle = constrain(tiltAngle, TILT_MIN, TILT_MAX);

  panServo.write(panAngle);
  tiltServo.write(tiltAngle);
}
```

The direction of each correction depends on how the servos are mounted. If the panel turns the wrong way, swap the `+` and `-` in that axis. Do not guess from the code; test it with a lamp and watch the panel.

A slow update rate, around five to ten times per second, is usually enough. Faster updates make the servos buzz without improving accuracy. If the tracker oscillates around the target, increase the deadband or reduce the step size. If it is too slow to follow a moving cloud edge, decrease the deadband or increase the step size. There is no single correct value; it depends on the servo speed, the frame mass, and how stable the light is.

A more advanced controller uses a proportional term: the step size is proportional to the light difference, with a maximum limit. That moves quickly when the error is large and gently when it is small. It is still a feedback loop, just a smoother one.

At night, the LDRs all read near zero and the tracker has no idea where the sun is. Park the panel facing south (in the northern hemisphere) or north (in the southern hemisphere) at a safe angle, and put the controller to sleep or stop moving until the light level rises. A simple threshold on the average LDR value is enough to detect night.

## Measuring the energy, not just the angle

The interesting question is not whether the panel points at the sun. It is whether the tracker collects more energy than a fixed panel of the same type under the same conditions. That requires measuring voltage and current over time and integrating power.

The INA219 makes this easy:

```cpp
#include <Adafruit_INA219.h>

Adafruit_INA219 ina219(0x40);

void setupPower() {
  if (!ina219.begin()) {
    Serial.println("INA219 not found");
    while (true) delay(1000);
  }
  ina219.setCalibration_32V_2A();
}

float readPowerW() {
  float busV = ina219.getBusVoltage_V();
  float currentA = ina219.getCurrent_mA() / 1000.0f;
  return busV * currentA;
}
```

The INA219 must be in the high side of the circuit: the panel's positive terminal goes into VIN+, the load connects to VIN−, and the shunt is between them. The ground is common. If you put it in the low side, the I2C ground reference can shift and the readings become nonsense.

For an energy comparison, log power every minute and sum it:

```cpp
float energyWh = 0.0f;
uint32_t lastSample = 0;

void accumulateEnergy() {
  uint32_t now = millis();
  if (now - lastSample >= 60000UL) {
    float hours = (now - lastSample) / 3600000.0f;
    energyWh += readPowerW() * hours;
    lastSample = now;
  }
}
```

A minute is coarse for a small panel, but it is fine for a day-long comparison. If you want better resolution, sample every ten seconds. The important thing is to use the same sampling interval for both panels and to log the raw voltage and current so you can check the arithmetic later.

The load matters. If the panel is open-circuit, the voltage is high and the current is zero. If it is short-circuited, the current is high and the voltage is zero. Neither tells you how much energy the panel can deliver. Use a resistive load or a proper charger and measure the power delivered to that load. For a fair comparison, both panels need the same load and the same orientation relative to the sun at the start of the test.

![IMAGE PLACEHOLDER: Two identical panels side by side, one fixed and one on the tracker, with INA219 sensors and a data logger](/images/dual-axis-solar-tracker-image-02.jpg)

## Calibration and mechanical construction

The mechanical frame is where most tracker projects lose their advantage. If the panel wobbles, the LDR array moves relative to the panel, and the controller aims the sensors rather than the panel. If the servo is carrying the panel's weight through its output shaft, the gears will wear and the angle will drift. Use a bearing or a pivot for the load, and let the servo drive the motion through a linkage.

Set the servo's mechanical center before attaching the panel. Use `writeMicroseconds()` if the default 0–180 mapping does not give you enough resolution. Check the full range of motion with the panel disconnected, then attach the panel and check again. A servo that hits a mechanical stop will buzz, heat up, and eventually strip a gear.

Calibrate the LDRs by covering each one in turn and confirming that the corresponding axis moves in the expected direction. Then aim the panel at a lamp and adjust the deadband until the tracker settles without oscillating. If the LDRs are mismatched, the tracker will have a constant offset; you can compensate in software by scaling each reading, but matched LDRs are easier.

## Troubleshooting the tracker

### The servos jitter or the ESP32 resets

This is a power problem. The servos draw a surge when they start, and the ESP32's supply cannot handle it. Use a separate 5–6 V supply, connect the grounds, add a large capacitor, and keep the servo wires away from the I2C and ADC lines. If the jitter only happens when the panel is at an extreme angle, the servo is probably stalling against a mechanical limit; reduce the range or fix the linkage.

### The tracker oscillates around the light source

The deadband is too small, the step size is too large, or the LDR readings are noisy. Average several samples, increase the deadband, and reduce the step. If the oscillation is slow and regular, it may be the servo's own dead band or gear backlash; a small amount of mechanical play can make the panel hunt back and forth. Tighten the linkage or add a spring to take up the slack.

### The LDR readings are stuck at maximum or minimum

The divider resistor is the wrong value for the light level, or the sensor is saturated. In direct sun, a 10 kΩ divider may push the ADC close to 3.3 V for all four sensors, which destroys the difference signal. Try a lower resistor value or put a diffuser over the LDRs. If the readings are stuck at zero, check the 3.3 V supply and the wiring; an LDR with a broken leg reads like darkness.

### The panel does not produce the expected power

Check the INA219 wiring first. The shunt must be in series with the load, and the high side is the safe place for it. If the current reads zero, the load may be open or the panel may be shaded. If the voltage reads zero, the panel may be reversed or the INA219 may be on the wrong side of the circuit. Also check the panel's rated voltage: a 6 V panel may produce 7 V open-circuit, which is fine for the INA219 but may not be fine for the charger you connected.

### The tracker is accurate at noon but useless in the morning

The LDR array may be shadowed by the frame, or the mechanical range may not cover the low sun angles. Check the panel's range of motion and the position of the cross divider. A tracker that cannot point east in the morning is not tracking the sun; it is tracking the part of the sky it can see.

## What the project is worth

For a science exhibition, the tracker is a strong visual. The panel moves, the numbers change, and the comparison with a fixed panel is easy to explain. The engineering concepts are real: feedback control, sensor characterization, mechanical design, and energy measurement. The project also gives you a reason to talk about the difference between power and energy, which is a distinction many people miss.

The real-world problem is renewable energy yield. Tracking can increase output, but it adds cost, complexity, and maintenance. A fixed panel with no moving parts is often the better engineering choice. Showing that trade-off is more interesting than claiming the tracker is always superior.

Two extensions are worth considering. The first is a single-axis versus dual-axis comparison, using the same panel and load, to see whether the extra axis earns its complexity at your latitude. The second is a solar position algorithm that computes the sun's azimuth and elevation from the date, time, and location, then uses the LDRs only for fine correction. That turns the tracker into a hybrid system and gives you a much better story about open-loop versus closed-loop control.

![IMAGE PLACEHOLDER: Chart comparing daily energy output of the tracking panel and the fixed panel](/images/dual-axis-solar-tracker-image-03.jpg)

The thing I like about this project is that it punishes wishful thinking. You can build a tracker that looks impressive and produces less energy than a fixed panel, and the INA219 will tell you. That is a useful lesson for any young engineer: the measurement is the argument, not the mechanism.
