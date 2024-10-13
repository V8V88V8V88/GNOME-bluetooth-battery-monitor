const { GObject, St, Gio, GLib } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Bluetooth = imports.ui.status.bluetooth;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const BluetoothBatteryMonitor = GObject.registerClass(
  class BluetoothBatteryMonitor extends PanelMenu.Button {
    _init() {
      super._init(0.0, "Bluetooth Battery Monitor");

      this._icon = new St.Icon({
        icon_name: "bluetooth-active-symbolic",
        style_class: "system-status-icon",
      });

      this.add_child(this._icon);

      this._deviceItems = new Map();
      this._bluetoothClient = Bluetooth.getClient();

      this._bluetoothClient.connect(
        "device-added",
        this._onDeviceAdded.bind(this),
      );
      this._bluetoothClient.connect(
        "device-removed",
        this._onDeviceRemoved.bind(this),
      );

      this._buildMenu();
      this._updateDevices();
    }

    _buildMenu() {
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      this.settingsItem = new PopupMenu.PopupMenuItem(_("Settings"));
      this.settingsItem.connect("activate", () => {
        ExtensionUtils.openPrefs();
      });
      this.menu.addMenuItem(this.settingsItem);
    }

    _updateDevices() {
      const devices = this._bluetoothClient.getDevices();
      devices.forEach((device) => {
        if (device.connected && !this._deviceItems.has(device.address)) {
          this._onDeviceAdded(this._bluetoothClient, device);
        }
      });
    }

    _onDeviceAdded(client, device) {
      if (!device.connected) return;

      const menuItem = new PopupMenu.PopupMenuItem(device.alias);
      menuItem.connect("activate", () => {
        // Implement disconnect functionality
        device.disconnect((error) => {
          if (error) {
            log(`Error disconnecting device: ${error.message}`);
          }
        });
      });

      const batteryLevel = new St.Label({ text: this._getBatteryText(device) });
      menuItem.add_child(batteryLevel);

      this.menu.addMenuItem(menuItem);
      this._deviceItems.set(device.address, { menuItem, batteryLevel });

      this._startBatteryMonitor(device);
    }

    _onDeviceRemoved(client, device) {
      const item = this._deviceItems.get(device.address);
      if (item) {
        item.menuItem.destroy();
        this._deviceItems.delete(device.address);
      }
    }

    _getBatteryText(device) {
      return device.battery_level !== null ? `${device.battery_level}%` : "N/A";
    }

    _startBatteryMonitor(device) {
      const updateBattery = () => {
        const item = this._deviceItems.get(device.address);
        if (item) {
          item.batteryLevel.text = this._getBatteryText(device);
        }
      };

      // Update every 5 minutes
      const sourceId = GLib.timeout_add_seconds(
        GLib.PRIORITY_DEFAULT,
        300,
        () => {
          if (device.connected) {
            updateBattery();
            return GLib.SOURCE_CONTINUE;
          } else {
            return GLib.SOURCE_REMOVE;
          }
        },
      );

      // Store the source ID to remove it later if needed
      this._deviceItems.get(device.address).sourceId = sourceId;
    }

    destroy() {
      this._deviceItems.forEach((item, address) => {
        if (item.sourceId) {
          GLib.source_remove(item.sourceId);
        }
      });
      super.destroy();
    }
  },
);

class Extension {
  constructor(uuid) {
    this._uuid = uuid;
    ExtensionUtils.initTranslations(this._uuid);
  }

  enable() {
    this._indicator = new BluetoothBatteryMonitor();
    Main.panel.addToStatusArea(this._uuid, this._indicator);
  }

  disable() {
    this._indicator.destroy();
    this._indicator = null;
  }
}

function init(meta) {
  return new Extension(meta.uuid);
}
