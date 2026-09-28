---
title: "Interfacing an HC-SR04 Ultrasonic Sensor with ESP32"
description: "A practical, wiring-first guide to reading distance from an HC-SR04 ultrasonic sensor on an ESP32 using the Arduino core, including the 5V-tolerance gotcha most tutorials skip."
date: 2026-09-21
updated: 2026-09-21
author: "Ajmal Ali A"
category: "ESP32"
tags:
  - ESP32
  - Ultrasonic-Sensor
  - HC-SR04
  - Electronics
  - Arduino
cover: "/images/hc-sr04-cover.jpg"
coverAlt: "HC-SR04 ultrasonic sensor wired to an ESP32 dev board on a breadboard"
draft: false
---

The HC-SR04 is a cheap, reliable way to measure distance — but wiring it
straight to an ESP32 the way you would an Arduino Uno will eventually let
out the magic smoke. This guide covers the wiring correctly, the code, and
why the "just connect it" tutorials are dangerous on this board.

## What you'll need

| Component | Notes |
| --- | --- |
| ESP32 dev board | Any common variant (DevKitC, WROOM-32, etc.) |
| HC-SR04 | Standard 4-pin ultrasonic distance sensor |
| Resistors | 1x 1kΩ and 1x 2kΩ (for the voltage divider) |
| Breadboard + jumper wires | — |

:::warning
The HC-SR04's **Echo** pin outputs 5V. ESP32 GPIO pins are **not 5V
tolerant** — feeding Echo directly into a GPIO can damage the pin or the
whole board. Always drop it through a voltage divider first.
:::

## Wiring

1. Connect HC-SR04 **VCC** to ESP32 **5V** (aka `VIN` on most boards).
2. Connect HC-SR04 **GND** to ESP32 **GND**.
3. Connect HC-SR04 **Trig** directly to any ESP32 GPIO (e.g. `GPIO5`) — Trig is an input to the sensor, so no divider needed here.
4. Build a simple two-resistor divider for **Echo**:
   - Echo → 1kΩ → GPIO18
   - GPIO18 → 2kΩ → GND

This divider brings the 5V Echo signal down to roughly 3.3V, which is safe
for the ESP32's input pins.

:::note
If you have a logic-level converter module handy, that works too and is
slightly more accurate than the resistor divider. For a single sensor, the
divider is simpler and cheap enough not to bother.
:::

## Firmware

This sketch targets the **ESP32 Arduino core v3.x** (board package
`esp32` ≥ 3.0.0 in Arduino IDE's Boards Manager, or `platform =
espressif32` pinned to a matching release in PlatformIO). The 3.x core
changed some LEDC/analog APIs versus 2.x, but this sketch only uses plain
digital I/O and timing, so it's unaffected either way — worth flagging
since so many ESP32 snippets online still target the older core.

```cpp
// HC-SR04 distance reader for ESP32 (Arduino core 3.x)
const int trigPin = 5;
const int echoPin = 18;

void setup() {
  Serial.begin(115200);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
}

void loop() {
  // Send a 10us trigger pulse
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  // Measure echo pulse width, with a timeout so a disconnected sensor
  // doesn't hang the loop forever
  unsigned long duration = pulseIn(echoPin, HIGH, 30000UL);

  if (duration == 0) {
    Serial.println("No echo received (out of range or wiring issue)");
  } else {
    float distanceCm = duration * 0.0343f / 2.0f;
    Serial.printf("Distance: %.1f cm\n", distanceCm);
  }

  delay(200);
}
```

Flash it, open the Serial Monitor at 115200 baud, and wave your hand in
front of the sensor. This sketch is a few hundred bytes of logic on top of
the core — it will fit comfortably in any ESP32 board's default flash
partition, so there's no partition-scheme tuning needed here.

## Troubleshooting

:::tip
Getting `0` or wildly inconsistent readings? Check these in order: the
divider resistor values, that Trig and Echo aren't swapped, and that the
sensor has a clear, flat surface within its ~2 cm–400 cm range in front of
it. Soft or angled surfaces absorb/deflect the pulse.
:::

- **Always reads 0** — usually a wiring issue on Echo, or the `pulseIn` timeout is too short for the distance you're testing.
- **Readings jump around** — add a small moving-average filter in software rather than trusting a single sample.
- **Sensor gets warm** — double check VCC is 5V, not 3.3V; the HC-SR04 is a 5V part and under-powering it gives unreliable pulses.

## Where to go next

Once you have raw distance readings, the next step is usually filtering
them and doing something with the result — logging over Wi-Fi, driving a
display, or triggering an action past a threshold. Related project ideas:
a parking-assist buzzer, a water-tank level monitor, or a simple people
counter using two sensors.
