---
title: "Building a LoRa-Based Disaster Alert Network"
description: "A practical design walkthrough for a long-range ESP32 and SX1278 LoRa disaster alert network, covering packet design, GPS, power budgeting, and the failures that actually bite."
date: 2026-11-02
updated: 2026-11-02
author: "Ajmal Ali"
category: "Projects"
tags:
  - ESP32
  - LoRa
  - IoT
  - Electronics
  - Arduino
cover: "/images/blog/lora-disaster-alert-network/hero.jpg"
coverAlt: "ESP32 and SX1278 LoRa modules assembled on a breadboard with a GPS antenna"
draft: false
---

The uncomfortable thing about a disaster is that it usually takes the convenient infrastructure with it. Cell towers lose power, Wi-Fi goes down, and the one person who knows where the emergency supplies are is standing behind a collapsed wall with no signal. A disaster alert network is interesting for exactly that reason: it has to keep working when the normal network does not.

This is the design I would build for a school exhibition. It is not a replacement for official emergency systems, and nobody should treat a hobby board as one. It is a local, low-power radio network that can carry short messages, GPS coordinates, and sensor readings between nodes a few kilometres apart. That is enough to demonstrate the engineering, and it is genuinely useful in a classroom-sized disaster drill.

## What the network actually needs to do

The first mistake is trying to make it do everything. A LoRa link is not a phone. It is a slow, narrow pipe that is very good at sending tiny amounts of information a long way on very little power. Once you accept that, the design becomes simpler.

The network has three roles. Sensor nodes sit in different locations, read temperature, humidity, rain, and GPS, and transmit a compact packet every minute or so. A gateway listens on the same radio settings, acknowledges packets, and forwards them to a local display, a siren, and optionally a Wi-Fi dashboard. An alert node is a stripped-down receiver with a buzzer and a big red button, so someone can trigger a local alarm without needing the internet.

The important architectural decision is that the gateway should not be a single point of failure for the alarm. If the Wi-Fi is down, the gateway can still sound its own siren and show the last known coordinates on an OLED. The cloud dashboard is a convenience, not the safety mechanism.

![IMAGE PLACEHOLDER: System architecture diagram showing sensor nodes, LoRa gateway, local siren, and optional Wi-Fi dashboard](/images/lora-disaster-alert-network-image-01.jpg)

## Choosing the radio, and the parts around it

The SX1278 is the cheap 433 MHz module that shows up everywhere as a red or blue breakout board. The SX1276 covers 868 MHz and 915 MHz, and the SX1262 is a newer, more power-efficient part with a different library. They are not interchangeable at the register level. Decide which band you are legally allowed to use before you buy anything, because the antenna and the module have to match the band.

A 433 MHz module will not work properly with a 868 MHz antenna, and it will work even less properly with a random piece of wire. The antenna is not optional. Transmitting into an open connector is a good way to cook the output stage. A quarter-wave antenna at 433 MHz is roughly 17 cm, but a proper spring or whip antenna with a ground plane is much better than a calculator-and-wire approximation.

The SX1278 is a 3.3 V part. Its current draw is modest while receiving, but the transmit peak can be over 100 mA, and cheap ESP32 boards do not always enjoy that kind of sudden load. I would power the radio from a dedicated 3.3 V regulator with a 470 µF bulk capacitor close to the module, not from the ESP32's 3.3 V pin if the board is also feeding a GPS and a sensor. The same applies to the GPS: startup current and radio transmit peaks happening together is a classic brownout recipe.

Here is the pin map I would use on a standard ESP32 DevKit. It avoids the input-only pins for outputs and keeps the SPI bus on the default VSPI pins.

| Signal | ESP32 pin | Notes |
| --- | --- | --- |
| SX1278 VCC | 3.3 V | Dedicated regulator preferred |
| SX1278 GND | GND | Common ground |
| SCK | GPIO 18 | VSPI clock |
| MISO | GPIO 19 | VSPI MISO |
| MOSI | GPIO 23 | VSPI MOSI |
| NSS / CS | GPIO 5 | Strapping pin; add a 10 kΩ pull-up |
| RESET | GPIO 14 | Outputs a PWM glitch at boot, harmless here |
| DIO0 | GPIO 26 | Interrupt or polling |
| DHT22 data | GPIO 4 | 10 kΩ pull-up to 3.3 V |
| Rain sensor digital | GPIO 27 | Comparator output, active low on many boards |
| GPS TX | GPIO 16 | Goes to ESP32 RX2 |
| GPS RX | GPIO 17 | Goes to ESP32 TX2 |
| Panic button | GPIO 32 | Input with internal pull-up |
| Buzzer | GPIO 25 | Through a transistor if it is loud |
| Battery sense | GPIO 34 | 100 kΩ / 100 kΩ divider, input-only pin |

GPIO 5 is a strapping pin, which means the ESP32 reads it at boot to decide the boot mode. The LoRa module's chip-select line idles high, so it is usually fine, but a pull-up removes the chance of the board refusing to boot when the radio board is unplugged or the wiring is loose. I avoid GPIO 12 and GPIO 15 for anything that might be pulled at boot for the same reason.

## Packet design is where the project gets real

A LoRa packet can carry up to 255 bytes, but you should not use anywhere near that. Every extra byte costs airtime, and airtime costs power and spectrum. A compact binary packet also avoids the overhead and parsing ambiguity of JSON.

I would use a packed struct with a magic byte, a version, a node ID, a sequence number, flags, fixed-point coordinates, temperature, humidity, battery voltage, and a checksum. The packed attribute matters because the compiler will otherwise insert padding between fields, and the receiver has no idea what padding you used.

```cpp
struct __attribute__((packed)) AlertPacket {
  uint8_t  magic;        // 0xA5
  uint8_t  version;      // 1
  uint8_t  nodeId;
  uint8_t  flags;        // bit 0 = panic, bit 1 = rain, bit 2 = GPS valid
  uint16_t seq;
  int32_t  lat_e7;       // latitude * 10,000,000
  int32_t  lon_e7;       // longitude * 10,000,000
  int16_t  temp_c_x100;  // temperature * 100
  uint16_t rh_x10;       // relative humidity * 10
  uint16_t battery_mv;
  uint8_t  crc;
};
```

Fixed-point integers are intentional. Sending a `float` over the air is fine on two identical ESP32s, but it makes the packet harder to inspect and invites disagreement when a different microcontroller joins the network. Latitude and longitude scaled by 10^7 give about 1 cm of resolution, which is far more than a hobby GPS needs.

The sequence number is what makes retries sane. The node increments it for every new packet, and the gateway remembers the last sequence number per node. If a packet arrives twice because the acknowledgement was lost, the gateway can drop the duplicate instead of logging the same emergency twice. Acknowledgements themselves should be tiny: a magic byte, the node ID, and the sequence number. The node waits a short time for that reply, retransmits a couple of times with a random delay, and then gives up and goes back to sleep. LoRa is not a guaranteed-delivery protocol, so the application has to provide that reliability.

The LoRa settings have to match exactly on both ends: frequency, spreading factor, bandwidth, coding rate, sync word, and CRC mode. A mismatch here is the most common reason a link that worked yesterday suddenly receives nothing. I would put those settings in one shared header file or configuration block rather than typing them twice.

## Firmware: transmit, acknowledge, sleep

The node firmware is a loop with three jobs: read sensors, build a packet, and manage the radio. The sleep part is what makes a battery-powered node practical. A development board with a USB chip and a power LED can waste more current than the radio, so the first thing to measure is the board's sleep current, not the ESP32 datasheet's.

The radio setup looks like this:

```cpp
#include <LoRa.h>

constexpr long LORA_FREQ = 433E6;
constexpr int  LORA_SS   = 5;
constexpr int  LORA_RST  = 14;
constexpr int  LORA_DIO0 = 26;

void setupRadio() {
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println("LoRa init failed");
    while (true) { delay(1000); }
  }
  LoRa.setSpreadingFactor(9);
  LoRa.setSignalBandwidth(125E3);
  LoRa.setCodingRate4(5);
  LoRa.setTxPower(17);
  LoRa.setSyncWord(0x12);   // private network; gateway must match
  LoRa.enableCrc();
}
```

Spreading factor 9 with 125 kHz bandwidth is a reasonable compromise for a school network: it is slower than SF7 but noticeably more robust at the edge of range. SF12 will reach further in theory, but the airtime becomes painful and the legal duty cycle becomes a real constraint. There is no point in a link that is technically alive but only allowed to transmit once every ten minutes.

The transmitter builds the packet, sends it, and waits for an acknowledgement:

```cpp
bool sendWithAck(AlertPacket &p, uint8_t nodeId) {
  for (uint8_t attempt = 0; attempt < 3; attempt++) {
    LoRa.beginPacket();
    LoRa.write(reinterpret_cast<uint8_t *>(&p), sizeof(p));
    LoRa.endPacket();

    uint32_t start = millis();
    while (millis() - start < 1500) {
      if (LoRa.parsePacket() >= 4) {
        uint8_t ack[4];
        LoRa.readBytes(ack, 4);
        if (ack[0] == 0x5A && ack[1] == nodeId) return true;
      }
    }
    delay(random(200, 800));
  }
  return false;
}
```

On the gateway side, the receive loop reads exactly `sizeof(AlertPacket)` bytes, validates the magic and checksum, and then decides whether the sequence number is new. If it is new, the gateway acknowledges and forwards the data. If it is old, it still acknowledges, because the node may simply not have heard the first acknowledgement. That distinction between "received" and "new" is easy to miss and causes a lot of confusing duplicate alerts.

For the GPS, the NEO-6M speaks NMEA over UART at 9600 baud by default. TinyGPSPlus is the least dramatic way to parse it. The important detail is that a GPS indoors will often report no fix at all, and a cold start outdoors can take anywhere from thirty seconds to a couple of minutes. The firmware should not block waiting for a fix. Send the packet with the GPS-valid flag clear, and let the gateway display the last known position separately. A node that refuses to transmit because it cannot see the sky is a node that fails at the worst possible moment.

## Power, range, and the boring realities

A solar-powered node sounds impressive until you measure the actual current. The radio transmit peak, the GPS acquisition, the sensor warm-up, and the ESP32 wake-up all overlap if you are careless. A 6 V 2 W panel and a single 18650 cell can keep a low-duty-cycle node alive, but only if the sleep current is genuinely low and the enclosure is not sitting in the shade. Use a proper charge controller, protect the battery from over-discharge, and put the electronics in a box that does not turn into an oven.

Range is the other place where expectations need managing. The datasheet number is measured under ideal conditions, with a good antenna, a clear line of sight, and a slow data rate. In a school building, with concrete walls and people, the usable range can be a fraction of that. The honest approach is to test it: put the gateway in one fixed spot, walk or cycle away with a node, and log RSSI, SNR, and whether each packet arrived. A simple CSV log on the gateway is more convincing than any claim in a blog post.

![IMAGE PLACEHOLDER: Two-node range test setup with the gateway on a table and a portable node with battery and antenna](/images/lora-disaster-alert-network-image-02.jpg)

## Troubleshooting the things that actually go wrong

### The radio initializes but no packets arrive

This usually looks like a perfectly healthy serial log on the transmitter and complete silence on the receiver. The first suspect is a settings mismatch: different frequency, spreading factor, bandwidth, sync word, or CRC mode. The second is the antenna. A module with no antenna can sometimes receive a packet if the transmitter is sitting on top of it, which is a cruel way to convince yourself the link works. The third is power: the SX1278 is a 3.3 V device, and feeding it 5 V is a quick way to produce a very quiet, very dead radio.

Diagnose it by printing the radio's version register or simply by running both boards on the same desk with a known-good antenna and identical settings. If that works, move them apart slowly. If it stops at one metre, the problem is almost certainly the antenna or the power supply, not the code.

### The node resets every time it transmits

A reset at the exact moment of transmission is a brownout, not a software bug. The transmit current spike pulls the 3.3 V rail down, the ESP32's brownout detector trips, and the board reboots. It can look like the code is stuck in a loop because the node keeps starting over.

Put a bulk capacitor near the radio, power the radio from a regulator that can actually supply the peak, and check the wiring resistance. A breadboard's thin jumper wires are not great at sudden current pulses. If the node is also driving a buzzer or a relay, give those their own supply and a separate ground return.

### Packets arrive, but the coordinates are nonsense

This is usually a struct layout or endianness problem. If the transmitter and receiver compiled the same struct with different padding, the fields shift and latitude becomes a temperature. Add a static assertion on the packet size, use the packed attribute consistently, and print the raw bytes on both ends during development. A magic byte and a version field are cheap insurance against a firmware update on only one side of the network.

If the coordinates are merely wrong rather than random, check the GPS sentence parsing and the sign convention. Latitude and longitude are signed, and a missing minus sign puts you in the wrong hemisphere. Also check the GPS-valid flag: a zero coordinate with the flag cleared means "unknown", not "the equator".

### The gateway hears the node, but the node never gets an acknowledgement

This is often a timing problem. The node starts listening too late, or the gateway takes too long to reply because it is busy writing to Wi-Fi or updating a display. Keep the gateway's receive path short: acknowledge first, then log and forward. If the gateway is using the same radio for both receiving and transmitting, it cannot do both at once, so the reply has to happen promptly after the packet is read.

Another cause is the acknowledgement packet being filtered out by the node's own parser. If the node expects a fixed length and the gateway sends a different length, the check fails and the node retries forever. Print the raw acknowledgement bytes once and stop guessing.

### The GPS never gets a fix indoors

This is not a fault. GNSS signals are weak, and a concrete roof is an effective shield. Take the module outside, give it a clear view of the sky, and wait. Cold starts take time. If it still never fixes outdoors, check the antenna connection, the UART baud rate, and whether TX and RX are crossed correctly. A GPS module's TX must go to the ESP32's RX, which is the opposite of what many people wire the first time.

## Why this belongs in a school exhibition

The strongest demonstration is not a static poster. Set up three nodes: one at the entrance, one in another room, and one outside with a GPS antenna. The gateway sits on the exhibition table with a siren and a small display. A judge presses the panic button on a node, and the gateway sounds the alarm and shows the node's ID and last known position. Then unplug the Wi-Fi router. The alarm still works, which is the entire point.

That demonstration lets you talk about the physics of radio propagation, the trade-off between range and data rate, the difference between a protocol and a guarantee, and the power budget of a battery device. It also gives you a reason to explain why LoRa is not a replacement for a mobile phone: it is slow, it is short-message, and it is regulated.

Two extensions are worth considering. The first is a simple mesh, where nodes can relay packets for each other. That turns a star network into something more resilient, but it also introduces routing loops, duplicate packets, and a lot of debugging. The second is a LoRaWAN gateway, which connects the nodes to an existing network server and gives you proper device management. Both are real engineering projects on their own, which is exactly why they make good next steps.

![IMAGE PLACEHOLDER: Gateway dashboard showing node status, last packet time, RSSI, and GPS coordinates on a map](/images/lora-disaster-alert-network-image-03.jpg)

The lesson I keep coming back to is that a disaster network is mostly a study in constraints. The radio is slow, the battery is finite, the antenna is imperfect, and the environment is hostile. A system that works under those constraints is more impressive than one that looks good in a diagram. Build the two-node link first. Make it survive a walk across the school field. Then add the third node, the GPS, and the dashboard. The network will teach you more in a week of range tests than a month of reading datasheets.
