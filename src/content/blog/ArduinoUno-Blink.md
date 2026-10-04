---
title: "Arduino UNO Blink: From Plugging It In to Your First Program"
description: "My beginner-friendly walkthrough of connecting an Arduino UNO, installing the Arduino IDE and drivers, selecting the board and COM port, and uploading the classic Blink program."
date: 2026-09-29
updated: 2026-09-29
author: "Ajmal Ali"
category: "Arduino"
tags:
  - Arduino
  - Arduino-UNO
  - Blink
  - Arduino-IDE
  - Electronics
  - Beginners
cover: "/images/blog/arduino-uno-blink/hero.jpg"
coverAlt: "Arduino UNO connected to a computer ready for programming"
draft: false
---

# Arduino UNO Blink: From Plugging It In to Your First Program

So, you just got an Arduino UNO.

You plug it into your computer.

A bunch of LEDs light up.

And then you stare at it thinking:

**"Okay... now what?"**

That was basically me when I started.

The famous first Arduino project is **Blink** — making the little built-in LED on the UNO turn on and off repeatedly.

It sounds ridiculously simple.

And honestly, it is.

But before that tiny LED can blink, there are a few things that can go wrong:

- Windows might not recognize the board.
- The wrong COM port might be selected.
- You might select the wrong board.
- Your USB cable might be a charging-only cable.
- The code might have a tiny mistake.
- And yes, you can spend 20 minutes debugging something that was literally just the wrong USB port.

So let's do the whole thing from the beginning.

![Arduino UNO connected to a computer](/images/blog/arduino-uno-blink/hero.jpg)

*The mission: get this little board to blink its LED.*

---

## What we're going to do

We're going from:

```text
"I have an Arduino UNO"
        ↓
Connect it to PC
        ↓
Install Arduino IDE
        ↓
Make sure Windows sees it
        ↓
Select UNO + COM port
        ↓
Write Blink
        ↓
Upload
        ↓
LED GOES BLINK BLINK
```

No external LED.

No breadboard.

No resistor.

Just the UNO and a USB cable.

---

# 1. Meet the Arduino UNO

The Arduino UNO is a microcontroller development board based on the **ATmega328P**.

In simple terms, it's a tiny computer designed to interact with electronics.

It has digital pins, analog inputs, power pins, a USB connection and a microcontroller that runs the code we upload to it.

![Arduino UNO board showing its main components](/images/blog/arduino-uno-blink/uno-board.jpg)

The important part for this tutorial is the **built-in LED**.

You don't need to connect an LED yourself.

The UNO already has one.

That's extremely convenient when you're trying to figure out whether your board is actually listening to you.

---

# 2. What do you need?

Very little.

| Thing | Why |
|---|---|
| Arduino UNO | The board we're programming |
| USB cable | Connects the UNO to the computer |
| Computer | Where we'll write the code |
| Arduino IDE | Software used to program the board |

That's it.

If you're expecting a giant pile of components, sorry.

Today's project is basically:

**UNO + USB cable + code.**

---

# 3. Plug the UNO into your computer

Take the USB cable and connect it to the USB port on the UNO.

Then connect the other end to your computer.

![Arduino UNO connected to a USB cable](/images/blog/arduino-uno-blink/usb-connection.jpg)

The UNO should power up.

You'll probably see the power LED turn on.

You may also see the built-in LED flash briefly while the board starts.

At this point, don't start worrying about the blinking yet.

We're just getting the computer and board to become friends.

---

# 4. Install the Arduino IDE

To write programs for the UNO, we'll use the **Arduino IDE**.

Download and install it from Arduino's official website.

![Arduino IDE installation](/images/blog/arduino-uno-blink/ide-install.jpg)

During installation, Windows may ask permission to install device drivers.

Let it.

This is one of those moments where clicking "Cancel" and then wondering why the Arduino isn't detected later is a spectacularly avoidable problem.

Once the installation finishes, open the Arduino IDE.

You should get a new sketch containing something like this:

```cpp
void setup() {

}

void loop() {

}
```

Don't panic.

Those two functions are basically the heart of an Arduino sketch.

We'll fill them in soon.

---

# 5. What are these mysterious "drivers"?

This confused me at first too.

Your computer needs a way to communicate with the Arduino over USB.

That's what the USB/serial hardware and its driver are there for.

With an **official Arduino UNO**, the USB interface is handled by the board's USB circuitry.

With some UNO-compatible boards, you might find a different USB-to-serial chip such as a **CH340**.

That's why one Arduino board can work immediately while another one suddenly decides:

> "I have no idea what this USB thing is."

If Windows doesn't detect your board, check **Device Manager**.

Open:

**Start → Device Manager → Ports (COM & LPT)**

You should see something representing the connected board, such as:

```text
Arduino Uno (COM5)
```

Your COM number will probably be different.

![Arduino COM port visible in Windows Device Manager](/images/blog/arduino-uno-blink/port-selection.jpg)

---

# 6. The classic beginner trap: the USB cable

Here's one that gets people surprisingly often.

**Not every USB cable carries data.**

Some cheap USB cables are made only for charging.

So your Arduino can happily light up and receive power...

...while your computer has absolutely no way to communicate with it.

If the board powers on but no new COM port appears, try another known-good **data USB cable**.

This is one of those problems where the Arduino looks completely alive while refusing to cooperate.

---

# 7. Select the Arduino UNO

Now open the Arduino IDE.

We need to tell it what board we're using.

Go to:

**Tools → Board → Arduino AVR Boards → Arduino Uno**

![Arduino UNO selected in the Arduino IDE](/images/blog/arduino-uno-blink/board-selection.jpg)

Make sure it actually says **Arduino Uno**.

This matters because the IDE needs to know what kind of hardware it's uploading to.

---

# 8. Select the COM port

Next:

**Tools → Port**

You'll probably see something like:

```text
COM5
COM7
```

Select the port belonging to your UNO.

![Arduino COM port selected in the Arduino IDE](/images/blog/arduino-uno-blink/port-selection.jpg)

### Don't know which one is your Arduino?

Here's my favorite simple trick.

1. Disconnect the UNO.
2. Open the Port menu.
3. Look at what ports are there.
4. Plug the UNO back in.
5. Open the menu again.
6. Find the port that appeared.

That's your board.

This is much easier than randomly clicking COM ports and hoping for the best.

---

# 9. Now for the actual Blink code

Okay.

Enough setup.

Let's finally make the thing do something.

Put this into the Arduino IDE:

```cpp
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);

  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}
```

![Blink code written in the Arduino IDE](/images/blog/arduino-uno-blink/blink-code.jpg)

That's the entire program.

It isn't doing anything fancy.

But there are a few important things hiding inside those lines.

---

# 10. What is `setup()`?

Look at this:

```cpp
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}
```

`setup()` runs **once** when the Arduino starts or resets.

Inside it, we have:

```cpp
pinMode(LED_BUILTIN, OUTPUT);
```

We're telling the Arduino:

> "We're going to control this LED."

`OUTPUT` means the Arduino will use that pin to send a signal out.

Think of it like setting the pin's job before we start using it.

---

# 11. What is `loop()`?

Then we have:

```cpp
void loop() {

}
```

This is where things get interesting.

The Arduino repeatedly runs whatever is inside `loop()`.

So if we write:

```cpp
void loop() {
  // stuff
}
```

the Arduino does:

```text
stuff
stuff
stuff
stuff
stuff
...
```

Forever.

Well, until you turn it off or reset it.

---

# 12. Turning the LED ON

Inside our loop:

```cpp
digitalWrite(LED_BUILTIN, HIGH);
```

`digitalWrite()` controls a digital output.

`HIGH` means we're putting the output into its high state.

For our purposes:

**HIGH = LED ON**

Then:

```cpp
delay(1000);
```

The Arduino waits.

The number is in milliseconds.

```text
1000 milliseconds = 1 second
```

So we have:

```text
LED ON
↓
Wait 1 second
```

---

# 13. Turning the LED OFF

Next:

```cpp
digitalWrite(LED_BUILTIN, LOW);
```

Now the LED turns off.

Then:

```cpp
delay(1000);
```

We wait another second.

So the entire loop is basically:

```text
ON
↓
wait 1 second
↓
OFF
↓
wait 1 second
↓
START AGAIN
```

And that's Blink.

---

# 14. Why `LED_BUILTIN`?

You might wonder why we didn't just write:

```cpp
13
```

The built-in LED on an Arduino UNO is connected to digital pin 13.

So technically this would work:

```cpp
pinMode(13, OUTPUT);

digitalWrite(13, HIGH);
```

But:

```cpp
LED_BUILTIN
```

is much clearer.

When I read:

```cpp
digitalWrite(LED_BUILTIN, HIGH);
```

I immediately know:

**"Turn on the built-in LED."**

---

# 15. Compile before uploading

Before sending the program to the UNO, let's check it.

Click the **Verify** button in the Arduino IDE.

The IDE will compile your program.

If everything is okay, the compilation should finish successfully.

This is useful because it catches code mistakes before we start blaming the USB cable, the board, the driver, Windows, the moon phase, or anything else.

---

# 16. Upload it

Now click **Upload**.

The IDE will:

```text
Compile code
     ↓
Connect to UNO
     ↓
Send program
     ↓
Reset UNO
     ↓
Run program
```

![Arduino IDE uploading the Blink program](/images/blog/arduino-uno-blink/uploading.jpg)

If the upload succeeds, you should see a successful upload message.

And now...

Look at the little LED.

---

# 17. IT BLINKS

![Arduino UNO with its built-in LED blinking](/images/blog/arduino-uno-blink/led-blinking.jpg)

There it is.

One second ON.

One second OFF.

Then repeat.

You have officially programmed your Arduino UNO.

It's a tiny project, but this is a pretty important moment.

You just went from:

```text
"I have an Arduino."
```

to:

```text
"I can tell this microcontroller what to do."
```

And that's the entire point of Arduino.

---

# 18. Let's mess with it

Now change this:

```cpp
delay(1000);
```

to:

```cpp
delay(500);
```

Upload it again.

Now the LED should blink faster.

Why?

Because:

```text
500 ms = 0.5 seconds
```

Try these:

```cpp
delay(100);
```

```cpp
delay(250);
```

```cpp
delay(2000);
```

Here's what they mean:

| Code | Delay |
|---|---:|
| `delay(100)` | 0.1 s |
| `delay(250)` | 0.25 s |
| `delay(500)` | 0.5 s |
| `delay(1000)` | 1 s |
| `delay(2000)` | 2 s |

Change the numbers.

Upload.

Watch what happens.

That's one of the best ways to learn Arduino: **change something and see what the hardware does.**

---

# 19. What if it doesn't work?

This is where things usually get interesting.

## Problem: No COM port

Check:

- Is the USB cable connected?
- Is the cable a data cable?
- Is the Arduino powered?
- Does Device Manager show the board?
- Does the board require a USB driver?
- Did you try another USB port?

---

## Problem: Upload failed

First check:

**Tools → Board**

Make sure it's:

```text
Arduino Uno
```

Then check:

**Tools → Port**

Make sure you've selected the UNO's actual COM port.

Also make sure another application isn't already using that serial port.

---

## Problem: "avrdude" errors

Don't immediately assume your Arduino is dead.

The usual things to check first are:

```text
Correct board?
Correct COM port?
Good USB cable?
Driver working?
Board connected?
```

Start with the boring stuff.

It saves a ridiculous amount of time.

---

# 20. What we actually learned

Blink looks like a five-line beginner program.

But getting it running introduced a surprisingly large number of concepts:

- Arduino UNO hardware
- USB communication
- Drivers
- COM ports
- Arduino IDE
- Board selection
- Uploading firmware
- `setup()`
- `loop()`
- `pinMode()`
- `digitalWrite()`
- `HIGH`
- `LOW`
- `delay()`
- Digital outputs

And most importantly:

**we made software control physical hardware.**

That's the part that makes Arduino fun.

---

# What's next?

Blink is basically the Arduino equivalent of saying:

**"Hello, world."**

Except instead of printing text on a screen, we're making an actual piece of hardware respond.

Next, we can get rid of the built-in LED and connect our **own LED + resistor** to the UNO.

Then we can add a button.

Then a sensor.

Then a display.

And before you know it, the five-line Blink program has turned into an actual electronics project.

For now, though:

**You plugged it in.  
You programmed it.  
You made it blink.**

That's a pretty good start.