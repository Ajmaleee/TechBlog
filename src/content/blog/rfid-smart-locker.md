---
title: "Designing an RFID-Based Smart Locker"
description: "Build an ESP32 RFID locker with MFRC522, keypad, OLED, servo lock, and access logs, plus the security limits nobody should ignore."
date: 2026-11-02
updated: 2026-11-02
author: "Ajmal Ali"
category: "Projects"
tags:
  - ESP32
  - RFID
  - Security
  - IoT
  - Electronics
cover: "/images/blog/rfid-smart-locker/hero.jpg"
coverAlt: "ESP32 RFID locker prototype with MFRC522 reader, keypad, OLED display, and servo lock"
draft: false
---

An RFID locker is one of those projects that looks impressive for about thirty seconds, until someone asks whether the card can be copied. The honest answer is usually yes. Most cheap cards are not secrets; they are identifiers. That does not make the project pointless. It makes it a very good way to learn the difference between identification, authentication, and actual security.

The version I would build for a school exhibition uses an ESP32, an MFRC522 reader, a 4x4 keypad, a small OLED, and a servo-driven latch. A card gets you to the PIN prompt. The PIN gets you inside. The ESP32 logs who opened the locker and when, and optionally pushes that log to Firebase so you can show a dashboard. It is a two-factor system built from parts that cost less than a takeaway meal, and it demonstrates why the second factor matters.

## What the locker is protecting, and from whom

A school locker is not a bank vault. The realistic threats are a curious classmate, a lost card, and someone who has watched too many YouTube videos about cloning tags. The realistic failure modes are a dead battery, a jammed servo, and a lock that traps someone inside. Those are the things the design should handle first.

That framing changes the architecture. The locker must fail safe: if the power dies, there must be a mechanical way to open it from the inside, and ideally a key override for the caretaker. The servo should not be the only thing standing between a person and the door. A small solenoid or a servo-driven latch is fine for a prototype, but it is not a security barrier. It is a demonstration of an access-control state machine.

The card is the "something you have". The PIN is the "something you know". Neither is strong on its own. Together they raise the effort required, and they give you something interesting to explain to a judge: a copied card alone is not enough, and a shoulder-surfed PIN alone is not enough.

## Hardware and pin map

The MFRC522 is a 3.3 V device. Its SPI lines are 3.3 V logic, and its power pin is not 5 V tolerant. Many breakout boards have a 3.3 V regulator and level shifting for the SPI lines, but not all of them do, and the silkscreen is not always honest. Check the board before connecting it to a 5 V rail. The safest assumption is 3.3 V for VCC, and 3.3 V logic.

The OLED is an SSD1306, usually at I2C address 0x3C, sometimes 0x3D. The keypad is a passive 4x4 matrix, so it needs eight GPIOs. The servo needs a PWM-capable pin and, more importantly, its own power supply.

| Signal | ESP32 pin | Notes |
| --- | --- | --- |
| MFRC522 SCK | GPIO 18 | VSPI clock |
| MFRC522 MISO | GPIO 19 | VSPI MISO |
| MFRC522 MOSI | GPIO 23 | VSPI MOSI |
| MFRC522 SS | GPIO 5 | Strapping pin; 10 kΩ pull-up |
| MFRC522 RST | GPIO 17 | Not a strapping pin |
| OLED SDA | GPIO 21 | I2C |
| OLED SCL | GPIO 22 | I2C |
| Keypad rows | GPIO 32, 33, 25, 26 | Row outputs/inputs depending on library |
| Keypad columns | GPIO 27, 14, 12, 13 | Avoid GPIO 12 at boot if possible |
| Servo signal | GPIO 4 | PWM |
| Buzzer | GPIO 2 | Optional feedback |
| Reed switch | GPIO 34 | Input-only; door-open sensor |

GPIO 12 is a strapping pin that affects the flash voltage on some ESP32 variants. Driving it at boot can prevent the board from starting. If you can, swap that keypad column to another pin, such as GPIO 16, and keep GPIO 12 free. If your board is a WROVER module, GPIO 16 and 17 may be used for PSRAM, so check the variant before committing to a pin map.

The servo is the part that catches people. An SG90 draws a few hundred milliamps when moving and can stall at over 700 mA. An MG996R is worse. The ESP32's 3.3 V regulator cannot supply that, and the 5 V pin on a USB-powered board is not much better. Use a separate 5 V supply rated for at least 2 A, connect the grounds together, and put a 470–1000 µF capacitor across the servo supply. A servo that jitters or resets the ESP32 is almost always a power problem, not a library problem.

## How the access state machine works

The firmware is easier to reason about as a state machine than as a pile of `if` statements. The states are idle, card seen, PIN entry, granted, denied, and locked out.

In idle, the reader polls for a card. When a card appears, the ESP32 reads its UID and checks it against an allowlist stored in NVS or LittleFS. If the UID is unknown, the display says so and the event is logged. If the UID is known, the display asks for the PIN. The user types four digits on the keypad. If the PIN matches that user's PIN, the servo opens the latch for a few seconds and the event is logged as granted. If the PIN is wrong, the attempt counter increments. After three failures, the keypad locks out for a minute.

The card read is straightforward with the MFRC522 library:

```cpp
#include <MFRC522.h>

MFRC522 rfid(5, 17);   // SS, RST

bool readCardUid(char *out, size_t outLen) {
  if (!rfid.PICC_IsNewCardPresent()) return false;
  if (!rfid.PICC_ReadCardSerial()) return false;

  out[0] = '\0';
  for (byte i = 0; i < rfid.uid.size; i++) {
    char hex[3];
    snprintf(hex, sizeof(hex), "%02X", rfid.uid.uidByte[i]);
    strncat(out, hex, outLen - strlen(out) - 1);
  }
  rfid.PICC_HaltA();
  return true;
}
```

The UID length is not always four bytes. MIFARE Classic cards usually have four, but seven-byte UIDs are common too. Store the full UID as a string, not as a 32-bit integer, or you will eventually meet a card that does not fit.

The allowlist can live in a small JSON file in LittleFS:

```json
{
  "users": [
    { "uid": "A1B2C3D4", "pinHash": "9f2c...", "name": "Ajmal" },
    { "uid": "11223344", "pinHash": "4a7d...", "name": "Guest" }
  ]
}
```

Do not store the PIN in plain text if you can avoid it. A salted hash is not perfect on a microcontroller, but it is better than a text file that anyone can read over serial. Use a random salt per user and a simple hash function; the point is to avoid casual disclosure, not to resist a determined attacker with physical access.

## Opening the latch without brownouts

The servo should move to the open position, hold for a moment, and then return. The hold time needs to be long enough for the door to be pulled open, but not so long that the servo buzzes against a mechanical stop. A typical value is two to three seconds.

```cpp
#include <ESP32Servo.h>

Servo lockServo;
constexpr int SERVO_PIN = 4;
constexpr int LOCKED_ANGLE = 0;
constexpr int OPEN_ANGLE = 90;

void unlockFor(uint32_t ms) {
  lockServo.write(OPEN_ANGLE);
  delay(ms);
  lockServo.write(LOCKED_ANGLE);
  delay(300);
}
```

That `delay()` is acceptable during a single unlock event, but it should not be used in the main loop for anything else. If you add a display animation or a network call, move the timing into a non-blocking state machine. Also, do not assume the servo's 0° and 90° positions match the mechanical latch. Adjust the angles until the latch moves cleanly without straining.

A better mechanical design uses a servo to retract a small latch, with a spring returning it to the locked position when the servo is unpowered. That way, a power failure does not leave the locker unlocked, and the servo is not fighting a spring continuously.

![IMAGE PLACEHOLDER: Close-up of the servo-driven latch mechanism and the door reed switch](/images/rfid-smart-locker-image-01.jpg)

## Logging access without lying to yourself

An access log is only useful if the timestamps are real. The ESP32 has no battery-backed clock by default, so after a power cut it has no idea what year it is. There are three practical options: add an RTC module such as the DS3231, sync time over NTP when Wi-Fi is available, or let the server timestamp the event. For a locker that may be offline, an RTC is the least fragile option.

The log entry should include the UID, the user name if known, the result (granted, denied, unknown card, door forced), the timestamp, and a sequence number. Store the last few hundred entries in LittleFS so the system can keep working when Wi-Fi is down. When the network returns, upload the backlog and clear it only after a successful acknowledgement. If you clear the log before the upload succeeds, you will lose the exact events you need to debug.

Firebase Realtime Database is a convenient place to put the log because it gives you a live dashboard for free. The ESP32 can write with a REST call:

```cpp
HTTPClient http;
WiFiClientSecure client;
client.setCACert(FIREBASE_ROOT_CA);   // do not ship setInsecure() in production
http.begin(client, "https://your-project-default-rtdb.firebaseio.com/logs.json?auth=" + idToken);
http.addHeader("Content-Type", "application/json");
int status = http.POST(payload);
```

The `auth` token is the part that trips people up. Firebase ID tokens expire after about an hour, so a device that runs for a week needs a refresh flow or a small backend that holds the credentials. Do not hardcode a database secret in the firmware; anyone with a USB cable can read it. A better design is a tiny server or Cloud Function that authenticates the locker and writes the log with server-side credentials. For a school demo, a local MQTT broker or a simple HTTP endpoint is often easier and avoids the token dance entirely.

The security rules matter as much as the code. If the database is open to writes, anyone who finds the URL can forge an entry. If it is open to reads, anyone can see who opened which locker. Lock both down, and give the dashboard a read-only account.

## Security, honestly

The MFRC522 reads MIFARE cards, and a UID is not a cryptographic secret. Many MIFARE Classic cards can be cloned with cheap tools, and the reader has no way to tell the clone from the original. If the locker only checks the UID, it is an identifier check, not authentication. Adding a PIN helps, but a four-digit PIN has only ten thousand combinations and can be observed.

For a real system, use cards with authenticated sectors or challenge-response, such as MIFARE DESFire EV2/EV3, and store a key in a secure element rather than in flash. Use a lock with a fail-safe mechanism, a tamper switch, and a battery backup. Log events to an append-only store. None of that fits in a weekend project, and that is worth saying out loud.

There is also a human side. A locker that cannot be opened from the inside is a safety hazard. A locker that logs every student's movements is a privacy problem. If this is a school project, use dummy cards and a model locker, not a real student's belongings, and get permission before collecting any personal data.

## Troubleshooting the build

### The reader reports version 0x00 or 0xFF

That usually means the SPI connection is not working. Check the wiring first: SCK, MISO, MOSI, SS, and RST all need to go to the pins in the code, and the MFRC522 needs 3.3 V, not 5 V. A loose jumper or a breadboard contact that has given up is more common than a dead reader. If the version is 0xFF, the MISO line may be floating or the reader may not be powered.

Some clone boards have a badly designed antenna trace or a missing component. Try a second reader before you rewrite the code. Also check that the SS pin in the `MFRC522` constructor matches the physical pin; a mismatch produces a reader that initialises but never sees a card.

### The OLED stays blank

The SSD1306 is usually at 0x3C, but some modules are at 0x3D. Run an I2C scanner and confirm the address before changing the code. If the scanner finds nothing, check SDA/SCL orientation, the 3.3 V supply, and whether the display's reset pin is tied correctly. Long I2C wires and missing pull-ups cause intermittent blank displays, especially when the servo moves.

### The keypad produces the wrong characters

A 4x4 keypad is a matrix, and the row and column pin order in the code has to match the physical wiring. If every key in a row produces the same character, the rows and columns are swapped. If a key produces two characters, the library's debounce is too short or the keypad is ghosting. Add a small delay after each keypress and ignore repeated keys until the key is released.

### The servo twitches and the ESP32 resets

This is almost always the servo supply. The servo's startup current pulls the 5 V rail down, and the ESP32 browns out. Use a separate 5 V supply, connect the grounds, add a large capacitor, and keep the servo wires away from the I2C lines. If the servo buzzes continuously, it is fighting a mechanical stop; adjust the angles or the linkage before the gearbox strips.

### Firebase returns 401 or permission denied

Check the token first. ID tokens expire, and a token that worked yesterday may be useless today. Then check the security rules: a write to `/logs` may be denied even if the token is valid. Finally, check the device clock. TLS validation and some token checks fail if the ESP32 thinks it is 1970. Sync time over NTP or use an RTC before blaming Firebase.

## Why build it for a science exhibition

The demo is easy to stage and easy to understand. A judge picks up a registered card, the OLED asks for a PIN, the correct PIN opens the latch, and the dashboard shows the event. Then the judge tries an unregistered card and gets a denial. Then they try the registered card with the wrong PIN and get a lockout. In two minutes, you have demonstrated identification, authentication, rate limiting, and audit logging.

The real-world problem is access control, which is everywhere: lockers, labs, server rooms, and front doors. The project shows that a card reader is not a security system on its own, and that the interesting engineering is in the state machine, the failure modes, and the logs.

Two extensions are worth considering. The first is a proper challenge-response card, such as a DESFire tag, with keys stored in a secure element. The second is a tamper-aware lock with a door sensor, a battery backup, and an offline cache that syncs when the network returns. Both turn the project from a toy into something that starts to resemble a real access-control system.

![IMAGE PLACEHOLDER: Access log dashboard showing card UID, user, timestamp, and granted or denied status](/images/rfid-smart-locker-image-02.jpg)

The most valuable thing this project teaches is not how to wire an MFRC522. It is how to look at a security feature and ask what it actually proves. A card proves possession. A PIN proves knowledge. A log proves that something happened, but only if the clock and the storage are trustworthy. Once you start asking those questions, you stop building demos that merely look secure.
