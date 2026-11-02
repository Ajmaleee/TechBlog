---
title: "Detecting Machine Failures with Vibration Analysis"
description: "Use an ESP32 and MPU6050 to collect vibration data, extract RMS and FFT features, and build an honest early-warning system for small machines."
date: 2026-11-02
updated: 2026-11-02
author: "Ajmal Ali"
category: "Projects"
tags:
  - ESP32
  - Vibration
  - Predictive-Maintenance
  - Sensors
  - Data-Science
cover: "/images/blog/vibration-based-failure-detection/hero.jpg"
coverAlt: "ESP32 vibration sensor mounted on a small motor with a laptop showing an FFT plot"
draft: false
---

Machines rarely fail without warning. A bearing wears, a mount loosens, a fan accumulates dust, and the vibration signature changes before the machine stops. Predictive maintenance is the practice of listening to those changes and acting before the breakdown. It is also a field where a cheap sensor and a good baseline can teach you more than an expensive instrument and no method.

The project I would build uses an ESP32 and an MPU6050 accelerometer mounted on a small motor or fan. The ESP32 samples the accelerometer at a fixed rate, computes time-domain features such as RMS and crest factor, and streams the data to a laptop for an FFT. The goal is not to diagnose a specific bearing fault from a datasheet. The goal is to establish a baseline, detect a change, and explain why the change matters.

## What vibration actually tells you

Vibration is motion. An accelerometer measures acceleration, which is the second derivative of position. For a machine, the interesting vibration is usually small and periodic: a rotating shaft, a gear mesh, a bearing defect, or a loose panel. The frequency of the vibration is often more informative than its amplitude.

A rotating machine produces a peak at its rotation frequency, often called 1X. An imbalance produces a strong 1X peak. A misalignment can produce 1X and 2X. A loose mount can produce harmonics and broadband noise. A bearing defect produces impacts at characteristic frequencies, which are often modulated by the rotation and show up as sidebands. Gear mesh produces a peak at the gear mesh frequency and its harmonics.

That is the theory. In practice, a cheap accelerometer on a small machine picks up all of it plus the fan, the frame, the table, and the person walking past. The useful skill is not memorising fault frequencies; it is learning to collect clean data and compare it to a baseline.

## Hardware and mounting

The MPU6050 is a 6-axis IMU with a 16-bit accelerometer. It is not a dedicated vibration sensor, but it is good enough for low-frequency machine monitoring. Set the accelerometer range to ±16 g for a motor, and the digital low-pass filter to a bandwidth that matches your sampling rate. If the signal clips, you will see flat-topped waveforms and a spectrum full of harmonics that are not real.

The mounting matters more than the sensor. A sensor held by hand or taped loosely to a vibrating surface will measure the mount, not the machine. Use a rigid mount: a small metal block glued to the machine, with the sensor screwed or clamped to it. A piece of double-sided foam tape is a low-pass filter and will hide high-frequency information. For a temporary setup, a strong magnet or a wax mount is better than tape, but a bolt is best.

| Signal | ESP32 pin | Notes |
| --- | --- | --- |
| MPU6050 SDA | GPIO 21 | I2C, 400 kHz |
| MPU6050 SCL | GPIO 22 | I2C |
| MPU6050 INT | GPIO 4 | Optional data-ready interrupt |
| Status LED | GPIO 2 | Sampling indicator |
| SD card CS | GPIO 5 | Optional local logging |
| SD card SCK | GPIO 18 | SPI |
| SD card MOSI | GPIO 23 | SPI |
| SD card MISO | GPIO 19 | SPI |

Power the MPU6050 from 3.3 V. Many breakout boards have a 5 V-tolerant regulator, but the bare chip is 3.3 V. Keep the I2C wires short; a long cable picks up noise and can cause bus lockups. If the sensor is far from the ESP32, use a shielded cable or move the ESP32 closer.

The machine itself needs to be safe. A fan with an exposed blade is a hazard. Use a small, guarded fan or a motor with a coupling guard. Do not put the sensor on a machine that can start unexpectedly. Use a low-voltage power supply and a switch you control.

## Sampling without lying about the rate

The Nyquist theorem says you must sample at more than twice the highest frequency you want to see. If you sample at 1 kHz, the highest usable frequency is 500 Hz. If the machine has interesting content above that, you need a faster sensor and a faster bus. For a small motor or fan, 1 kHz is usually enough.

The ESP32's `loop()` is not a reliable clock. Use a timer or a fixed-interval loop based on `micros()`, and record the actual timestamp of each sample. If the loop jitters, the FFT will smear the peaks and the frequencies will be slightly wrong.

```cpp
#include <Wire.h>
#include <MPU6050.h>

MPU6050 mpu;
constexpr uint32_t SAMPLE_INTERVAL_US = 1000; // 1 kHz
uint32_t nextSample = 0;

void setup() {
  Wire.begin(21, 22);
  Wire.setClock(400000);
  mpu.initialize();
  mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_16);
  mpu.setDLPFMode(MPU6050_DLPF_BW_94);
  nextSample = micros();
}

void loop() {
  if ((int32_t)(micros() - nextSample) >= 0) {
    int16_t ax, ay, az;
    mpu.getAcceleration(&ax, &ay, &az);
    // Convert to g and store or stream.
    nextSample += SAMPLE_INTERVAL_US;
  }
}
```

The `int32_t` cast handles the `micros()` rollover. If the loop falls behind, the `nextSample` value will drift; you can either catch up or reset it. For a fixed-length capture, reset the timer at the start of each record and store the actual sample interval.

The MPU6050's internal sample rate and DLPF also matter. If the sensor's internal rate is lower than your loop rate, you will read duplicate samples. Set the sample rate divider and the DLPF to match the bandwidth you need. A 94 Hz DLPF with a 1 kHz sample rate is a reasonable starting point; it removes high-frequency noise but preserves the machine's main vibration bands.

Do not stream raw 1 kHz data over Wi-Fi if you can avoid it. A 1 kHz stream of three axes at 16 bits is about 6 kB/s before overhead, which is manageable, but it is fragile. A better design computes features on the ESP32 and sends a compact record every second, while storing the raw waveform locally for detailed analysis.

## Time-domain features

The simplest features are often the most useful. RMS is the overall vibration energy. Peak is the maximum absolute value. Crest factor is peak divided by RMS, which rises when the signal has sharp impacts. Kurtosis measures how heavy the tails of the distribution are; a bearing with spalling produces impulses and a higher kurtosis.

```cpp
struct Features {
  float rms;
  float peak;
  float crest;
  float kurtosis;
};

Features computeFeatures(const float *x, size_t n) {
  float sum = 0, sum2 = 0, sum4 = 0, peak = 0;
  for (size_t i = 0; i < n; i++) {
    float v = x[i];
    sum += v;
    sum2 += v * v;
    sum4 += v * v * v * v;
    if (fabsf(v) > peak) peak = fabsf(v);
  }
  float mean = sum / n;
  float var = sum2 / n - mean * mean;
  float rms = sqrtf(var);
  float m4 = sum4 / n;
  return { rms, peak, rms > 0 ? peak / rms : 0, var > 0 ? m4 / (var * var) : 0 };
}
```

Remove the mean before computing RMS. A sensor mounted at an angle has a DC component from gravity, and that offset will dominate the RMS if you do not subtract it. For a fan or motor, the vibration signal is usually zero-mean after detrending.

A single RMS value is not enough. The same RMS can come from a smooth imbalance or a series of sharp impacts. Crest factor and kurtosis help distinguish them. But neither is a diagnosis; they are indicators. A high crest factor means "look at the waveform", not "the bearing is failing".

## Frequency-domain analysis

The FFT turns a time-domain waveform into a spectrum. The peaks tell you which frequencies are present, and the frequencies tell you which mechanical components might be involved. The analysis is usually done on a laptop in Python, because the ESP32's floating-point performance and memory are limited.

```python
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv("vibration.csv")
x = df["ax"].to_numpy()
fs = 1000.0  # sampling rate in Hz

x = x - x.mean()
window = np.hanning(len(x))
spectrum = np.fft.rfft(x * window)
freqs = np.fft.rfftfreq(len(x), 1 / fs)
magnitude = np.abs(spectrum) / (len(x) / 2)

peak_idx = np.argmax(magnitude[1:]) + 1
print("dominant frequency:", freqs[peak_idx], "Hz")

plt.plot(freqs, magnitude)
plt.xlabel("Frequency (Hz)")
plt.ylabel("Magnitude")
plt.xlim(0, fs / 2)
plt.show()
```

Use a window function such as Hann to reduce spectral leakage. Without a window, a strong peak can smear energy into neighbouring bins and hide smaller peaks. Normalise the magnitude consistently so you can compare records, and keep the same window and record length for every measurement.

The frequency resolution is `fs / N`. A 1 kHz sample rate with a 4096-sample record gives a resolution of about 0.24 Hz. A longer record gives better resolution but takes more time and may include speed changes. For a machine that runs at a constant speed, a one- or two-second record is a good compromise.

For bearing analysis, the characteristic frequencies depend on the bearing geometry: the number of balls, the ball diameter, the pitch diameter, and the contact angle. You can calculate them, but you need the bearing's part number. Do not guess. If you cannot identify the bearing, use the spectrum to detect a change rather than to name a fault.

Envelope analysis is the next step for bearing faults. You band-pass the signal around a resonance, take the envelope, and compute its spectrum. The envelope spectrum reveals the impact repetition rate, which is often more diagnostic than the raw spectrum. It is more complex, but it is the right tool if you want to go beyond a demo.

![IMAGE PLACEHOLDER: FFT plot comparing a healthy fan and a fan with an imbalance, with the 1X peak highlighted](/images/vibration-based-failure-detection-image-01.jpg)

## Building a baseline and detecting change

The most important measurement is the baseline. Run the machine in good condition, at the same speed and load, and record several captures. Compute the features and the spectrum. Do this on different days and at different temperatures, because the baseline is not a single number; it is a distribution.

Then define a threshold. A simple approach is to use the mean plus three standard deviations of the baseline RMS. A more robust approach is to use the median and the median absolute deviation, which are less sensitive to outliers. For the spectrum, compare band energies rather than individual bins; individual bins are noisy, but a band around a known frequency is more stable.

Do not set the threshold from a single baseline capture. You will get false alarms. Collect at least ten captures over a few days, and include the normal variation in load and temperature. If the machine is new and you have no history, use a conservative threshold and treat the first week as a learning period.

A simple anomaly detector can run on the ESP32:

```cpp
bool isAnomalous(const Features &f, const Features &baseline, float k) {
  return f.rms > baseline.rms + k * baseline.rms * 0.3f
      || f.crest > baseline.crest * 1.5f
      || f.kurtosis > baseline.kurtosis * 1.8f;
}
```

The multipliers are placeholders. Tune them with real data, and require the condition to persist for several records before sending an alert. A single spike is usually a bump or a loose cable, not a failing bearing.

If you want to go further, train a classifier on labelled data. Collect examples of healthy operation, imbalance, looseness, and bearing wear. Extract features, train a random forest or a small neural network, and test on data from a different day. Be careful: a model trained on one machine may not generalise to another, and a model that memorises the test setup is not useful. Report your validation method, not just your accuracy.

## Troubleshooting the data

### The signal is pure noise

Check the mounting first. A sensor that is not rigidly attached will pick up the cable and the frame. Check the accelerometer range; if it is set to ±2 g, a motor will clip it. Check the power supply and the I2C wires. A loose ground or a long cable can inject noise that looks like vibration.

If the noise is at a specific frequency, suspect the fan or the power supply. A switching regulator can produce a tone, and a fan blade passing frequency is a real signal. Compare the spectrum with the machine off; if the peak is still there, it is electrical or environmental.

### The FFT peaks are at the wrong frequency

The sample rate is probably not what you think it is. `delay(1)` is not a 1 kHz clock; it is at least 1 ms plus the loop time. Use `micros()` and record the actual interval. If the interval varies, the FFT assumes uniform sampling and the peaks will smear. For a quick check, feed a known signal (a function generator or a phone tone) and see where it appears.

Also check the accelerometer's internal sample rate. If the sensor updates at 500 Hz and you sample at 1 kHz, you will see duplicate values and a spectrum that looks like it has content at the wrong frequencies.

### The baseline changes from day to day

Temperature, load, and mounting all affect vibration. A machine on a wooden table will behave differently from the same machine on a concrete floor. Record the conditions with each capture: speed, load, temperature, and mounting. If the baseline shifts, compare records taken under similar conditions, or normalise by speed.

A loose sensor is a common cause of a sudden baseline change. Mark the mount position and check it before every session. A sensor that has rotated by a few degrees can change the measured axes and the spectrum.

### The system reports false alarms

Your threshold is too tight, or your features are too noisy. Require persistence: three anomalous records in a row, not one. Use a robust baseline (median and MAD) and compare band energies instead of single bins. Log the raw waveform for every alarm so you can inspect it later. A false alarm that you can explain is a useful data point; a false alarm that you cannot explain is a bug.

### The I2C bus locks up

Long wires, missing pull-ups, or a device that holds the bus low can cause a lockup. Reduce the I2C speed, shorten the wires, and add a bus recovery routine that clocks SCL until the bus is free. If the ESP32 resets when the motor starts, the motor's electrical noise is coupling into the I2C lines; add twisted pair, a ferrite bead, or move the sensor.

## The demo and the honest claim

The best demonstration is a controlled change. Record a healthy fan, then attach a small piece of tape to one blade to create an imbalance, and record again. The 1X peak grows, the RMS rises, and the change is visible in the spectrum. Then remove the tape and show that the signal returns to baseline. That is a complete measurement story: baseline, intervention, effect, recovery.

Do not claim that the system diagnoses a bearing fault unless you have actually tested a bearing fault. A cheap accelerometer can detect a change, but naming the fault requires geometry, speed, and often a more sensitive sensor. The honest claim is "this machine's vibration changed, and here is the evidence". That is still valuable, and it is the foundation of predictive maintenance.

Two extensions are worth considering. The first is a wireless sensor node with local feature extraction and a long battery life, so you can monitor several machines without running cables. The second is an automated baseline that adapts to normal operating conditions and flags only persistent changes. Both require careful data collection and validation, which is exactly the skill the project is meant to teach.

![IMAGE PLACEHOLDER: Comparison of time-domain waveforms for a healthy fan and an imbalanced fan](/images/vibration-based-failure-detection-image-02.jpg)

The lesson I would take away is that data is not the same as insight. A thousand samples per second is easy; knowing which samples matter is hard. A baseline, a controlled change, and a clear plot will teach you more than a complicated model trained on data you do not understand.
