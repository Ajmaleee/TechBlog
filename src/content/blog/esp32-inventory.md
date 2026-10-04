---
title: "Building My ESP32 Inventory Manager: RTC, Keypad, OLED, Sleep Modes and What's Next"
description: "A look inside my ESP32-based inventory manager and dashboard, including the custom keypad, RTC integration, power optimization, LittleFS storage, and plans for voice control."
date: 2026-10-04
updated: 2026-10-04
author: "Ajmal Ali A"
category: "ESP32"
tags:
  - ESP32
  - Electronics
  - Inventory
  - OLED
  - RTC
  - Keypad
  - LittleFS
  - IoT
  - Arduino
  - Embedded-Systems
cover: "/images/blog/esp32-inventory-manager/hero.jpg"
coverAlt: "ESP32-based inventory manager with OLED display and keypad"
draft: false
---

# Building My ESP32 Inventory Manager

This is one of those projects that started as a relatively simple idea and then somehow turned into **an entire ecosystem of hardware, software, debugging, questionable wiring decisions, and way too many feature ideas.**

The basic idea was simple:

I own a stupid amount of electronic modules.

I keep them in pouches and trays.

And every time I need something, I end up thinking:

> "Where the hell did I put that?"

So I decided to build something that would actually tell me.

But I didn't want to stop at an inventory database.

I wanted the device itself to become a little desktop companion — something that could manage my components, run timers, handle Pomodoro sessions, show the time, and eventually even understand voice commands.

This is the current version.

![My ESP32 inventory manager](/images/blog/esp32-inventory-manager/hero.jpg)

*The project I've been slowly turning from "inventory tracker" into a proper little embedded system.*

---

# What is this thing?

At its core, this is an **ESP32-based inventory manager and dashboard**.

The inventory side keeps track of roughly **230 electronic modules and components** that I own.

Instead of remembering where everything is manually, I can search for a component and have the device tell me where it lives.

For example:

```text
OLED
↓
SH1106
↓
Tray C
↓
Pouch C14
```

That's already useful.

But inventory management isn't the only thing this device does.

I'm also building it around things I actually use at my electronics bench:

- Study timers
- Pomodoro
- General timers
- Clock
- Inventory search
- Component lending/return tracking
- Local storage
- A custom keypad interface
- And eventually voice control

Basically, I wanted a tiny electronics-bench assistant.

---

# The hardware

The current hardware setup contains quite a few parts.

The main components are:

| Component | Purpose |
|---|---|
| ESP32 | Main microcontroller |
| SSD1306 OLED | Main display |
| 4×4 keypad | User input |
| RTC module | Accurate timekeeping |
| Toggle switch | Power control |
| Button | Additional input |
| Battery | Portable power |
| LittleFS | Local inventory storage |

The ESP32 is doing most of the heavy lifting.

I'm using almost all of its useful functionality for this project, with **Bluetooth currently being the exception**.

![The hardware build](/images/blog/esp32-inventory-manager/build-1.jpg)

The whole thing is basically becoming a small standalone computer.

And yes, I know that calling an ESP32 a "computer" is going to annoy somebody.

I'm still calling it that.

---

# The OLED problem

The current display is an **SSD1306 OLED**.

It works.

It looks good.

It's also tiny.

Like, *really* tiny when you're sitting at my electronics bench.

![Current OLED display and enclosure](/images/blog/esp32-inventory-manager/build-2.jpg)

When I'm sitting directly in front of the device, it's fine.

But from a little farther away, especially while I'm working on another circuit, I have to lean forward just to read what's happening.

Not exactly the best user experience.

So one of the upgrades I want to make is replacing the OLED with a **TFT display**.

That would give me considerably more screen space and open up much more room for a proper interface.

I'm not changing it immediately because the current OLED still works perfectly well.

I'm just reaching the point where the screen is becoming the limiting factor.

---

# The keypad

This is probably my favorite part of the project.

The device uses a **4×4 matrix keypad**.

But I didn't want it to behave like a normal calculator keypad.

I wanted something closer to the old Nokia-style text input system.

You know the one.

Press a number once → first letter.

Press it twice → second letter.

Press it three times → third letter.

For example, pressing:

```text
5
5
```

can produce:

```text
K
```

So instead of having a full keyboard, I can use a small number of physical buttons to enter text.

![The keypad used for the inventory manager](/images/blog/esp32-inventory-manager/build-2.jpg)

This becomes especially useful for the inventory search interface.

Instead of navigating through hundreds of components manually, I can type a search term and narrow it down.

It's basically **Nokia keyboard nostalgia, but running an inventory database on an ESP32.**

---

# Why the RTC?

The device also has an RTC module.

This is important because I don't want the ESP32 running continuously.

The device has a **2,200 mAh battery**, so leaving everything powered and running all the time isn't exactly ideal.

The RTC allows the device to keep track of the actual time independently.

That means the ESP32 doesn't have to constantly stay awake just to know what time it is.

And this became especially important when I started working on the power-management side of the project.

But before that could happen...

I had to actually get the RTC working.

---

# The RTC was not working

This was one of those bugs where you start questioning everything.

I connected the RTC.

Uploaded the test code.

And...

Nothing.

The module wasn't being detected properly.

At first I thought the module itself might be faulty.

Then I started checking the wiring.

And eventually I found the problem.

**I had the SDA and SCL lines switched.**

Yep.

That was it.

The module wasn't dead.

My wiring was.

![RTC wiring during debugging](/images/blog/esp32-inventory-manager/rtc-wiring.jpg)

This is exactly why I like making small test sketches before integrating a module into the main project.

If I had immediately thrown the RTC code into the entire inventory system, debugging this would have been much more annoying.

Instead, I isolated the problem.

---

# Sharing the I²C bus

There was another thing to consider.

The OLED was already using I²C.

So now I had another I²C device — the RTC — that also needed SDA and SCL.

Rather than treating the RTC as a completely separate system, I worked around the existing pin arrangement and reorganized the connections.

I moved the relevant connections from the previous arrangement around pins 16 and 17 and kept the I²C communication properly organized for the RTC and display.

The important lesson here was simple:

**I²C devices can share the same bus.**

You don't necessarily need a completely different pair of pins for every I²C module.

They communicate using their device addresses.

That means an OLED and RTC can coexist on the same SDA/SCL lines as long as their addresses don't conflict.

---

# Testing the RTC separately

Once the wiring was fixed, I wrote a small test sketch specifically for the RTC.

The goal was simple:

```text
ESP32
  ↓
RTC
  ↓
Read date
Read time
Read other available information
  ↓
Print everything
```

![RTC test sketch and serial output](/images/blog/esp32-inventory-manager/rtc-test.jpg)

And finally...

It worked.

Mostly.

There was just one tiny problem.

The time was wrong.

Because of course it was.

---

# The time was completely off

The RTC was communicating properly.

The date and other information were being retrieved.

But the actual time was offset.

At first, I thought I had another wiring problem.

Thankfully, this time it wasn't.

The RTC simply needed to be set to the correct time.

The coin cell inside the module was also nearly dead, so I replaced it with a new one.

Then I wrote the correct date and time into the RTC.

![RTC time being configured](/images/blog/esp32-inventory-manager/rtc-time.jpg)

After that, the RTC could maintain the time independently.

This is a pretty important part of the final design because the ESP32 doesn't have to stay powered continuously just to maintain the clock.

---

# Power became the next problem

Once the major hardware was working, I started looking at power consumption.

And this is where the project started exposing another problem.

The ESP32 was doing **way too much work**.

The OLED was staying active constantly.

The software was also calculating time through multiple layers of the system.

And the main loop was running far more frequently than it actually needed to.

Basically, the ESP32 was doing a lot of work just to sit there and wait for me to press a button.

Not exactly battery-friendly.

---

# Enter: light sleep

I decided to implement **light sleep**.

The ESP32 has different power-management modes.

For this project, light sleep made sense because I still want the device to wake up quickly when needed.

The basic idea is:

```text
Device is idle
       ↓
No user input
       ↓
ESP32 enters light sleep
       ↓
Power consumption drops
       ↓
Wake when required
       ↓
Handle input / update screen
       ↓
Go back to sleep
```

![Power optimization and sleep-mode implementation](/images/blog/esp32-inventory-manager/power-optimization.jpg)

The OLED can remain powered separately because the display is an external module, while the ESP32 itself spends more time in its low-power state.

The RTC can also continue keeping track of the time independently.

That means I don't need the ESP32 running its CPU at full speed just because I want to know what time it is.

---

# Reducing the loop cycle

I also reduced how frequently the main program loop needed to perform work.

Before optimization, the device was constantly checking and calculating things that didn't need to be checked constantly.

After restructuring the logic, the ESP32 could spend more time doing nothing.

That sounds like a bad thing.

For a battery-powered embedded system, it's actually exactly what you want.

If nothing is happening:

**Don't waste power pretending something is happening.**

The combination of better loop timing and light sleep noticeably reduced the device's power consumption.

That should increase the usable battery life of the 2,200 mAh battery.

---

# The inventory itself

The other major part of the project is the inventory database.

I have around **230 modules and components** that I want to keep track of.

Instead of storing everything only in my head, the device keeps the inventory locally using **LittleFS**.

That means the ESP32 can store the inventory data in its flash filesystem.

A component can have information such as:

```text
Name
Location
Quantity
Availability
Lending status
```

So if I'm looking for something like an ESP32-CAM, I don't have to start opening random pouches.

I can search for it.

The device tells me where it is.

That's the whole point.

---

# The device is becoming more than an inventory tracker

At this stage, I realized something.

I don't actually want this to be *just* an inventory manager.

I use my electronics bench for everything:

- Programming
- Studying
- Building circuits
- Testing sensors
- Soldering
- Debugging
- Randomly taking apart things I probably shouldn't

So why not make the device useful for all of that?

That's why the dashboard also has timers and a Pomodoro system.

The idea is to have one device sitting on my bench that I can glance at and immediately know:

```text
Current time
       +
Current timer
       +
Study session
       +
Inventory
       +
Component locations
```

---

# And then I started leaving empty space...

If you look at the physical build, there is some empty space underneath the OLED.

![Reserved space for future modules](/images/blog/esp32-inventory-manager/future-modules.jpg)

That space isn't accidental.

I'm leaving it open for future hardware.

One of the modules I want to add is an **INMP441 microphone**.

And this is where the project gets considerably more interesting.

---

# The future: "Hey, Jarvis"

The next major feature I want to experiment with is voice control.

The plan is to add an **INMP441 I²S microphone** to the device.

Eventually, I want to be able to say something like:

> "Hey, Jarvis."

The device would wake up and listen for a command.

For example:

> "Hey, Jarvis, go to the inventory."

Or:

> "I want to take an OLED module and an ESP32-CAM."

The idea is that the assistant would understand the request and update the inventory stored in LittleFS.

So instead of:

```text
Press buttons
↓
Open inventory
↓
Search
↓
Select OLED
↓
Select ESP32-CAM
↓
Update inventory
```

I could eventually do:

```text
"Hey, Jarvis, take an OLED and an ESP32-CAM."
```

And let the device handle the rest.

![Current build with space reserved for future modules](/images/blog/esp32-inventory-manager/final-build.jpg)

That is still future work.

The ESP32 isn't magically going to become a fully autonomous AI assistant just because I plugged a microphone into it.

There is a *lot* to figure out:

- Wake-word detection
- Speech recognition
- Audio processing
- Command parsing
- Inventory updates
- Memory limitations
- Processing limitations
- And probably several new problems I haven't even managed to create yet

But that's the direction I'm taking it.

---

# A slightly embarrassing amount of debugging

One thing I've learned from this project is that the final build doesn't show how much debugging went into it.

Someone looking at the finished device might see:

```text
ESP32
OLED
Keypad
RTC
Battery
```

and think:

> "Cool. Just connect everything and write the code."

Absolutely not.

There were:

- Incorrect I²C wiring
- An RTC that appeared to be completely dead
- A nearly dead RTC battery
- Keypad connection problems
- Excessive power consumption
- Software doing unnecessary calculations
- Display limitations
- And several moments where I had to go back and rethink the architecture

And honestly, that's probably the most useful part of building something like this.

The mistakes are where you actually learn what's happening.

---

# The current architecture

At the moment, the system roughly looks like this:

```text
                 ┌───────────────┐
                 │    ESP32      │
                 │ Main Control  │
                 └───────┬───────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
       OLED           Keypad           RTC
     Display           Input        Timekeeping
          │              │              │
          └──────────────┼──────────────┘
                         │
                         ▼
                    LittleFS
                  Inventory Data

Future:
                         │
                         ▼
                      INMP441
                    Voice Input
```

This is still evolving.

The hardware isn't finished.

The software definitely isn't finished.

And that's kind of the point.

---

# What I want to add next

The next stages of the project are already pretty obvious.

### TFT display

The SSD1306 is useful, but it's becoming too small for the interface I want.

A larger TFT should make the dashboard much easier to use.

### INMP441 microphone

This is the big one.

Voice input could completely change how I interact with the inventory.

### Vibration motor

I'm also considering adding a small vibration motor for silent notifications and feedback.

### Better animations

The interface can eventually have proper visual feedback for:

- Timers
- Pomodoro sessions
- Alarms
- Inventory actions
- Sleep/wake states

### More intelligent inventory commands

Eventually, I want natural language commands to work with the inventory instead of requiring everything to be entered manually.

---

# The project isn't finished

And that's probably the best way to describe it.

This isn't a finished commercial product sitting in a box.

It's something I'm actively building on my electronics bench.

Every time I add a feature, another problem appears.

Fix the RTC → discover the time is wrong.

Fix the time → start thinking about battery life.

Fix the power consumption → realize the interface could be better.

Improve the interface → realize the display is too small.

Plan a bigger display → suddenly I'm thinking about voice control.

And somehow we ended up here.

![The current ESP32 inventory manager build](/images/blog/esp32-inventory-manager/final-build.jpg)

The crappy photos are also part of the experience.

My camera is cooked.

I had to grab some screenshots from a video because apparently even the device storage decided it was done cooperating.

So no, these aren't exactly professional product shots.

But they're real.

This is what the project actually looked like while I was building it.

---

# Final thoughts

What started as a simple way to remember where I put my electronics has turned into a much bigger embedded-systems project.

The current version can already:

- Track roughly 230 components
- Store inventory locally
- Search the inventory
- Track component locations
- Run timers
- Run Pomodoro sessions
- Display information on an OLED
- Keep time using an RTC
- Use a Nokia-style keypad interface
- Reduce power consumption using ESP32 sleep functionality

And there's still a ridiculous amount left to build.

The next major goal is turning it into something I can actually **talk to**.

If I can eventually walk up to my bench and say:

```text
"Hey, Jarvis.
I need an OLED and an ESP32-CAM."
```

and have the device update the inventory without me touching the keypad...

then I think this project will have officially gone from **"inventory tracker"** to **"my slightly over-engineered electronics bench assistant."**

And honestly?

That's exactly where I want it.