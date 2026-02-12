# Bluetooth Battery Monitor

A GNOME Shell extension that shows battery levels of connected Bluetooth devices right in your top panel.

## Features

- Battery icon in the top panel showing the lowest connected device's charge
- Color-coded fill: green (>50%), yellow (>20%), red (<=20%)
- Hover to see the exact percentage (can be disabled to avoid layout shifts)
- Option to always show percentage in the panel
- Option to hide the original Bluetooth icon so only this extension's icon is shown
- Click to see all connected devices with individual battery levels
- Configurable polling interval (1-60 minutes)

## Installation

### From GNOME Extensions

[<img src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg?sanitize=true" height="100">](https://extensions.gnome.org/away/https%253A%252F%252Fgithub.com%252FV8V88V8V88%252FGNOME-bluetooth-battery-monitor)

### Manual

```bash
git clone https://github.com/V8V88V8V88/GNOME-bluetooth-battery-monitor.git

cd GNOME-bluetooth-battery-monitor

mkdir -p ~/.local/share/gnome-shell/extensions/

cp -r bluetooth-battery-monitor@v8v88v8v88.com ~/.local/share/gnome-shell/extensions/
glib-compile-schemas ~/.local/share/gnome-shell/extensions/bluetooth-battery-monitor@v8v88v8v88.com/schemas/
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
