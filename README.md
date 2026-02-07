# Bluetooth Battery Monitor

A GNOME Shell extension that shows battery levels of connected Bluetooth devices right in your top panel.

## Features

- Battery icon in the top panel showing the lowest connected device's charge
- Color-coded fill: green (>50%), yellow (>20%), red (<=20%)
- Hover to see the exact percentage
- Click to see all connected devices with individual battery levels
- Configurable polling interval (1-60 minutes)

## Installation

### From GNOME Extensions

Install from [extensions.gnome.org](https://extensions.gnome.org/extension/TODO/).

### Manual

```bash
git clone https://github.com/V8V88V8V88/GNOME-bluetooth-battery-monitor.git
cd GNOME-bluetooth-battery-monitor
cp -r bluetooth-battery-monitor@v8v88v8v88.com ~/.local/share/gnome-shell/extensions/
cd ~/.local/share/gnome-shell/extensions/bluetooth-battery-monitor@v8v88v8v88.com/schemas
glib-compile-schemas .
```

Then restart GNOME Shell (log out and back in on Wayland) and enable the extension:

```bash
gnome-extensions enable bluetooth-battery-monitor@v8v88v8v88.com
```

## Supported GNOME Versions

45, 46, 47, 48, 49

## How It Works

The extension reads battery data from UPower over D-Bus. Any Bluetooth device that reports its battery level through UPower will show up automatically.

## License

GPL-3.0
