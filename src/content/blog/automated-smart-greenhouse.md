---
title: "Building an Automated Smart Greenhouse"
description: "An ESP32 greenhouse controller with capacitive soil sensors, DHT22, relay-driven irrigation, hysteresis logic, and the power and calibration problems that make or break it."
date: 2026-11-02
updated: 2026-11-02
author: "Ajmal Ali"
category: "Projects"
tags:
  - ESP32
  - IoT
  - Sensors
  - Electronics
  - Arduino
cover: "/images/blog/automated-smart-greenhouse/hero.jpg"
coverAlt: "Small model greenhouse with an ESP32 controller, soil moisture probes, and a water pump"
draft: false
---

A plant does not care about your dashboard. It cares about whether the soil around its roots is wet enough, and it does not send a notification when it is not. That is the honest reason automatic irrigation is worth building: the interesting part is not the Wi-Fi graph, it is the control logic that decides when to run a pump and, more importantly, when not to.

This greenhouse is a small model, not a commercial growing room. That is a feature. It fits on a school table, it uses a low-voltage pump, and every part of the control loop can be explained without hand-waving. The same logic scales up, but the safety requirements change dramatically when you start switching mains-powered pumps.

## The control problem, before the electronics

The naive version reads a soil sensor and turns the pump on when the reading is low. That works for about a day. Then the pump short-cycles: the soil surface gets wet, the sensor reads "wet", the pump stops, the water drains, the sensor reads "dry", and the pump starts again. The roots get a series of small shocks, the relay clicks itself to death, and the water bill goes up.

The fix is hysteresis. You define two thresholds instead of one. The pump turns on below, say, 35 percent moisture and does not turn off until the reading climbs above 45 percent. That ten-point gap is the hysteresis band. It stops the controller from reacting to every bit of sensor noise and gives the water time to spread through the soil.

There are two other rules I would add. First, a minimum off-time: once the pump has run, it stays off for at least twenty or thirty minutes so the water can actually reach the roots. Second, a maximum run-time: if the sensor is broken or the pump is disconnected, the controller must not run the pump forever. A simple "stop after sixty seconds and raise a fault" rule prevents a flooded tray and a burnt pump.

![IMAGE PLACEHOLDER: Graph showing soil moisture falling, the pump turning on at 35 percent, and the moisture rising before the pump turns off at 45 percent](/images/automated-smart-greenhouse-image-01.jpg)

## Parts, and the ones I would avoid

The ESP32 is overkill for a single plant, but it is the right choice when you want Wi-Fi, several sensors, and a display without adding another board. The capacitive soil moisture sensor is the important choice. The cheap resistive probe with two exposed metal prongs is essentially an electrolysis experiment: it corrodes, its readings drift, and it adds salts to the soil. The capacitive version still is not a laboratory instrument, but it lasts far longer and does not need to be replaced every few weeks.

The DHT22 measures temperature and humidity. It is slow, it is not especially accurate, and it has a minimum read interval of about two seconds. That is fine for a greenhouse. It is not fine if you put it in a tight loop and expect instant updates.

The relay module needs a proper explanation because it is where a lot of builds go wrong. A 5 V relay coil draws more current than an ESP32 GPIO can supply, so the module has a transistor and usually an optocoupler. Many modules are active-low: the input pin is pulled low to energise the relay. That is not a bug, but it means your code has to invert the logic. The relay contacts also need a flyback path for an inductive load, and the pump needs its own power supply. Do not run a pump from the ESP32's 5 V pin and expect the board to survive the startup current.

For a school build, use a 5 V or 12 V DC pump and a matching supply. If you insist on a mains pump, the switching side must be enclosed, earthed where required, and supervised by someone qualified. The microcontroller side is never a substitute for proper electrical safety.

| Component | Recommendation | Why |
| --- | --- | --- |
| Controller | ESP32 DevKit | Wi-Fi, ADC, enough GPIO |
| Soil sensor | Capacitive v1.2 or similar | Less corrosion than resistive probes |
| Temperature/humidity | DHT22 / AM2302 | Cheap, adequate for a greenhouse |
| Pump switch | 5 V relay module with optocoupler, or logic-level MOSFET | Separate load supply |
| Pump | 5 V or 12 V DC submersible | Safe for a tabletop demo |
| Display | SSD1306 OLED, I2C | Local readings without a phone |
| Power | 5 V 2 A supply for logic, separate supply for pump | Avoid brownouts |

## Wiring and pin choices

The ESP32's ADC is not as simple as an Arduino Uno's. ADC1 pins (GPIO 32–39) work while Wi-Fi is active; ADC2 pins (GPIO 0, 2, 4, 12–15, 25–27) share hardware with the Wi-Fi radio and can behave badly or fail when Wi-Fi is on. Put analog sensors on ADC1 and keep the relay and other digital outputs away from the strapping pins.

| Signal | ESP32 pin | Notes |
| --- | --- | --- |
| Soil sensor 1 | GPIO 34 | ADC1, input-only |
| Soil sensor 2 | GPIO 35 | ADC1, input-only |
| Soil sensor 3 | GPIO 32 | ADC1 |
| DHT22 data | GPIO 4 | 10 kΩ pull-up to 3.3 V |
| Relay IN | GPIO 26 | Often active-low |
| Float switch | GPIO 27 | Input with pull-up; use for a water-level cutoff |
| OLED SDA | GPIO 21 | I2C |
| OLED SCL | GPIO 22 | I2C |
| Status LED | GPIO 2 | Onboard LED on many boards |
| Manual button | GPIO 33 | Input with pull-up |

The capacitive sensor's analog output is typically somewhere between about 1.2 V and 3.0 V depending on moisture, but the exact range varies between modules and even between units of the same model. Do not trust a tutorial's calibration numbers. Calibrate each probe yourself: record the raw value in dry air, then in a cup of water, and use those two points to map the reading to a percentage. The relationship is not perfectly linear, but it is close enough for irrigation decisions.

If the ESP32 Arduino core is version 3.x, `analogReadMilliVolts()` gives a calibrated millivolt reading that is much more stable than raw `analogRead()`. It is still worth taking several samples and using the median. A single reading can be disturbed by the Wi-Fi radio, a nearby pump, or a loose jumper.

## Firmware that does not block

The controller should never sit in a `delay()` while something else needs attention. A simple state machine with `millis()` timestamps is enough. The loop reads the sensors on a schedule, updates the display, publishes to the dashboard, and decides whether the pump should be on.

Here is the core of the irrigation decision:

```cpp
constexpr float DRY_THRESHOLD = 35.0f;
constexpr float WET_THRESHOLD = 45.0f;
constexpr uint32_t MIN_OFF_MS = 20UL * 60UL * 1000UL;
constexpr uint32_t MAX_RUN_MS = 60UL * 1000UL;

bool pumpOn = false;
uint32_t pumpStartedAt = 0;
uint32_t pumpStoppedAt = 0;

void updatePump(float moisturePercent) {
  uint32_t now = millis();

  if (!pumpOn && moisturePercent < DRY_THRESHOLD &&
      now - pumpStoppedAt > MIN_OFF_MS) {
    digitalWrite(RELAY_PIN, RELAY_ACTIVE_LEVEL);
    pumpOn = true;
    pumpStartedAt = now;
  }

  if (pumpOn && (moisturePercent > WET_THRESHOLD ||
                 now - pumpStartedAt > MAX_RUN_MS)) {
    digitalWrite(RELAY_PIN, !RELAY_ACTIVE_LEVEL);
    pumpOn = false;
    pumpStoppedAt = now;
  }
}
```

The `RELAY_ACTIVE_LEVEL` constant is there so the active-low behaviour is explicit instead of being buried in a `digitalWrite(pin, LOW)` that looks like a mistake. If the relay is active-low, set it to `LOW`; if it is active-high, set it to `HIGH`. That one line has saved me from more confusing debugging than almost anything else.

The sensor read should average or median several samples:

```cpp
float readSoilPercent(uint8_t pin, int dryRaw, int wetRaw) {
  const int samples = 9;
  int values[samples];
  for (int i = 0; i < samples; i++) {
    values[i] = analogRead(pin);
    delay(5);
  }
  std::sort(values, values + samples);
  int raw = values[samples / 2];          // median
  float pct = 100.0f * (dryRaw - raw) / float(dryRaw - wetRaw);
  return constrain(pct, 0.0f, 100.0f);
}
```

Notice the direction: for most capacitive sensors, the raw value is higher when dry and lower when wet. If your sensor is the other way around, the formula will produce negative percentages and you will know immediately. Calibrate `dryRaw` and `wetRaw` per probe and store them in the firmware or in NVS.

For the dashboard, publish a small JSON payload every minute. Do not publish every loop iteration; it wastes power and makes the graph unreadable. A retained MQTT message with temperature, humidity, soil percentage, pump state, and a fault code is enough. If you use a local web server instead, keep the HTML tiny and cache it.

## Building the physical model

The mechanical side matters more than people expect. A soil probe pushed into the same spot every time will give repeatable readings; a probe that gets moved around will not. Mark the insertion depth on the probe body with a piece of tape. Put the sensor between the plant and the drip point, not directly under the nozzle, or it will measure the water stream rather than the root zone.

The pump should sit in a reservoir with a strainer, and the tubing should have a check valve or a siphon break. Otherwise, when the pump stops, water can continue to flow by gravity and empty the reservoir onto the floor. That is not a software bug, but it looks like one when the tray is flooded and the sensor says the soil is wet.

![IMAGE PLACEHOLDER: Close-up of the capacitive soil probe, drip tubing, and reservoir with the pump](/images/automated-smart-greenhouse-image-02.jpg)

Use a separate 5 V or 12 V supply for the pump, with the ground connected to the ESP32 ground. Put a 1000 µF capacitor across the pump supply near the driver, and a flyback diode across a DC motor or relay coil. If the pump is switched by a relay module, the module's own flyback diode may be enough for the coil, but the pump motor still produces noise. A snubber across the contacts or a properly rated MOSFET with a diode is better for a DC pump.

## Calibration and testing

Calibration is a five-minute job that saves hours of confusion. Label each probe, record its dry and wet raw values, and write them into the code. Then test the hysteresis with a glass of water: dry the probe, watch the percentage fall, and confirm the pump turns on only below the dry threshold. Add water slowly and confirm it turns off above the wet threshold. If it chatters at the boundary, your thresholds are too close together or your sensor is noisy.

Test the fault paths too. Disconnect the soil sensor while the pump is running: the controller should stop after the maximum run-time. Unplug the pump: the relay should still click, but the current sensor or the float switch should eventually report a problem. A float switch in the reservoir is a cheap way to stop the pump before it runs dry.

## Troubleshooting the failures I would expect

### The soil reading is always 0 percent or always 100 percent

This usually means the probe is on the wrong pin, the calibration values are reversed, or the sensor is not getting power. Check the voltage on the sensor's output with a multimeter while the probe is in air and in water. If the voltage does not change, the probe or its cable is the problem. If it changes but the ESP32 does not see it, check that you are using an ADC1 pin and that the GPIO number in the code matches the physical pin, not the silkscreen label.

### The relay clicks, but the pump does nothing

The relay is switching, so the control side is probably fine. The fault is on the load side: the pump supply is off, the relay is wired to the normally-closed contact instead of the normally-open contact, or the pump needs more current than the supply can deliver. Measure the voltage at the pump terminals while the relay is energised. If it is zero, trace the contact wiring. If it collapses when the pump is connected, the supply is too weak or the wiring is too thin.

Also check the relay logic. Many modules energise when the input is low. If your code assumes active-high, the relay will click in the opposite pattern to what you expect, and the pump will run when the soil is wet. That is a surprisingly easy mistake to make at 1 a.m.

### The ESP32 reboots when the pump starts

This is a brownout caused by the pump's startup current. The ESP32 and the pump are sharing a supply, or the ground return is inadequate. Give the pump its own supply, keep the grounds connected at one point, add bulk capacitance, and make sure the relay or MOSFET is not back-feeding the ESP32 rail. A 5 V pump that draws 1 A at startup will not be happy on a 500 mA USB charger.

### The DHT22 returns NaN or fails intermittently

The DHT22 needs a pull-up resistor on the data line and at least two seconds between reads. Long cables pick up noise, and the sensor is sensitive to supply voltage. If it works on a short jumper and fails on a long cable, move the sensor closer or add a small RC filter. Also check that you are not reading it from inside a timer interrupt; the library timing can be disrupted by other interrupts.

### Wi-Fi connects, but the analog readings go crazy

You are probably using an ADC2 pin. The Wi-Fi radio and ADC2 share resources on the ESP32, and the result can be invalid or unstable. Move the sensor to GPIO 32–39. If you have more analog sensors than ADC1 pins, use an external I2C ADC such as the ADS1115 instead of fighting the internal one.

## What a judge should see

A working greenhouse demo is more convincing when the control logic is visible. Put the moisture graph on a screen next to the model. Let the judge watch the line fall, see the pump start, and watch the line rise. Then change the dry threshold on the dashboard and show that the behaviour changes. That turns a "sensor plus pump" project into a demonstration of feedback control.

The real-world problem is water waste. Agriculture uses a lot of it, and a lot of irrigation is scheduled by habit rather than by measurement. A hobby prototype will not fix that, but it shows the difference between open-loop scheduling and closed-loop control.

Two extensions are worth the effort. The first is zone control: three valves and three sensors, so the controller waters only the dry part of the bed. The second is a weather-aware skip, where the controller checks a local forecast or a rain sensor and refuses to water before a storm. The second one is trickier than it sounds, because forecasts are wrong and a failed API call must not leave the plants dry.

![IMAGE PLACEHOLDER: Dashboard screenshot with soil moisture history, temperature, humidity, and pump state](/images/automated-smart-greenhouse-image-03.jpg)

The part I find most satisfying is that the project is honest about its limits. A capacitive probe is not a laboratory instrument, the DHT22 is not a precision sensor, and a relay is not a smart irrigation controller. But the control loop, the calibration, and the failure handling are real. Get those right on a tabletop model, and you have learned the part that actually transfers to a bigger system.
