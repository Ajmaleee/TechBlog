---
title: "Welcome to My Electronics Blog"
description: "A personal technical blog where I document electronics projects, Arduino experiments, ESP32 builds, sensors, IoT, and the things I learn along the way."
date: 2026-09-28
updated: 2026-09-28
author: "Ajmal Ali A"
category: "General"
tags:
  - Electronics
  - Arduino
  - ESP32
  - IoT
  - Projects
  - Tutorials
cover: "/images/blog-cover.jpg"
coverAlt: "Electronics components, an ESP32 development board, and jumper wires on a workbench"
draft: false
---

# Welcome to my blog

This is my little corner of the internet for **electronics, embedded systems, Arduino, ESP32, IoT, and things I build while figuring stuff out.**

I'll be using this blog to document projects, experiments, tutorials, troubleshooting, and the occasional idea that starts with *"I wonder if this would actually work."*

## What I post here

The main focus is practical electronics and embedded development.

Expect posts about:

- **Arduino** projects and experiments
- **ESP32** development
- Sensors and modules
- Circuits and wiring
- Embedded programming
- IoT projects
- Displays, communication modules, and microcontrollers
- Electronics troubleshooting
- Project builds and experiments
- Beginner-friendly tutorials
- Things I learn while building

Some posts will be polished tutorials. Others will be more like development logs where I document what worked, what didn't, and how I eventually fixed it.

:::note
The goal isn't to make every project look perfect. I'd rather document the actual process, including mistakes and troubleshooting, because that's usually where the useful stuff is.
:::

## Why I'm making this

A lot of electronics tutorials show the final circuit and the final code, but skip the messy part in between.

You connect something.

It doesn't work.

You check the wiring.

Still nothing.

You spend an hour wondering whether the sensor is broken, only to discover that one wire was connected to the wrong GPIO.

I've learned quite a bit from those situations, so I want this blog to be a place where I can document the process properly.

For example, a typical project might go from:

```text
Idea
  ↓
Circuit
  ↓
First prototype
  ↓
Something doesn't work
  ↓
Debugging
  ↓
Fix
  ↓
Working project
  ↓
Documentation
```

That entire process is worth documenting.

## The hardware

Most of the projects here revolve around inexpensive and accessible hardware.

Some of the boards and modules I work with include:

| Hardware | Typical use |
| --- | --- |
| Arduino | Prototyping and experiments |
| ESP32 | Wi-Fi, IoT and embedded projects |
| OLED displays | Small device interfaces |
| GPS modules | Location and tracking |
| GSM modules | Cellular communication |
| Accelerometers | Motion and vibration sensing |
| Soil sensors | Agriculture and environmental projects |
| nRF24L01 | Wireless communication |

The exact hardware will change from project to project. That's part of the fun.

## What you can expect from a tutorial

When possible, I'll keep project posts structured around the things that actually matter when building the project.

### 1. What we're building

A quick explanation of the project and what it is supposed to do.

### 2. Components

A straightforward parts list instead of making you hunt through the article for every component.

### 3. Wiring

Clear pin mappings and diagrams wherever they make sense.

### 4. Code

Complete working examples with explanations of the important parts.

```cpp
void setup() {
  Serial.begin(115200);
}

void loop() {
  Serial.println("Hello from my workshop.");
  delay(1000);
}
```

### 5. Testing

What to expect when the project is working and how to verify it.

### 6. Troubleshooting

The problems I encountered, common mistakes, and fixes.

:::tip
If something doesn't work, don't immediately assume the code is broken. Check power, ground, wiring, pin numbers, module voltage requirements, and serial output first.
:::

## Projects

I'll also use this site to document larger projects rather than only standalone tutorials.

That could mean an environmental monitoring system, an ESP32-based device, a wireless experiment, or something completely different.

For larger builds, I'll try to document the project as it evolves instead of only publishing the final version.

That means you might see:

**v0.1 → prototype → debugging → v0.2 → hardware changes → final build**

And yes, there will probably be some questionable wiring along the way.

## Learning in public

I'm still learning.

That means some articles may be updated when I discover a better approach, find an error, or learn something new.

If an article changes substantially, I'll update its revision date and document important changes where appropriate.

:::warning
Electronics projects involve real hardware. Always check voltage levels, current requirements, polarity, and component specifications before connecting unfamiliar hardware.
:::

## The stack behind this blog

The site itself is built around a simple workflow:

```text
Markdown
   ↓
GitHub
   ↓
Astro
   ↓
Static build
   ↓
Cloudflare Pages
```

Articles are written as Markdown and stored alongside the site's source code. Git keeps track of changes, while the build system turns the Markdown into the actual website.

The result is a fast, mostly static site without a database or complicated publishing system.

## Start building

If you're here because you're interested in electronics, hopefully you'll find something useful.

I'll be documenting projects, experiments, tutorials, failures, fixes, and everything in between.

This blog is essentially my workshop notebook — just slightly more organized.

**Let's build something.**