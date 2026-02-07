import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const UPOWER_BUS = 'org.freedesktop.UPower';
const UPOWER_PATH = '/org/freedesktop/UPower';
const UPOWER_IFACE = 'org.freedesktop.UPower';
const DEVICE_IFACE = 'org.freedesktop.UPower.Device';
const PROPERTIES_IFACE = 'org.freedesktop.DBus.Properties';

const BluetoothBatteryIndicator = GObject.registerClass(
class BluetoothBatteryIndicator extends PanelMenu.Button {
    _init(extensionObj) {
        super._init(0.0, 'Bluetooth Battery Monitor');

        this._extensionObj = extensionObj;
        this._settings = extensionObj.getSettings();

        this._icon = new St.Icon({
            icon_name: 'bluetooth-active-symbolic',
            style_class: 'system-status-icon',
        });
        this.add_child(this._icon);

        this._signalIds = [];
        this._setupUPowerProxy();
        this._refresh();
        this._startPolling();
    }

    _setupUPowerProxy() {
        this._upower = Gio.DBusProxy.new_for_bus_sync(
            Gio.BusType.SYSTEM,
            Gio.DBusProxyFlags.NONE,
            null,
            UPOWER_BUS,
            UPOWER_PATH,
            UPOWER_IFACE,
            null,
        );

        const id = this._upower.connect('g-signal', (_proxy, _sender, signal) => {
            if (signal === 'DeviceAdded' || signal === 'DeviceRemoved')
                this._refresh();
        });
        this._signalIds.push({obj: this._upower, id});
    }

    _enumerateDevices() {
        try {
            const result = this._upower.call_sync(
                'EnumerateDevices',
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null,
            );
            return result.deep_unpack()[0];
        } catch (e) {
            console.error(`BluetoothBatteryMonitor: ${e.message}`);
            return [];
        }
    }

    _getDeviceProperties(objectPath) {
        try {
            const proxy = Gio.DBusProxy.new_for_bus_sync(
                Gio.BusType.SYSTEM,
                Gio.DBusProxyFlags.NONE,
                null,
                UPOWER_BUS,
                objectPath,
                PROPERTIES_IFACE,
                null,
            );

            const result = proxy.call_sync(
                'GetAll',
                new GLib.Variant('(s)', [DEVICE_IFACE]),
                Gio.DBusCallFlags.NONE,
                -1,
                null,
            );

            const props = result.deep_unpack()[0];
            return {
                type: props['Type']?.deep_unpack(),
                model: props['Model']?.deep_unpack() || 'Unknown Device',
                percentage: props['Percentage']?.deep_unpack() || 0,
                isPresent: props['IsPresent']?.deep_unpack() || false,
            };
        } catch (_e) {
            return null;
        }
    }

    _refresh() {
        this.menu.removeAll();

        const devicePaths = this._enumerateDevices();
        let hasDevices = false;

        for (const path of devicePaths) {
            const props = this._getDeviceProperties(path);
            if (!props || !props.isPresent)
                continue;

            if (props.type === 1 || props.type === 2)
                continue;

            hasDevices = true;
            const batteryText = `${Math.round(props.percentage)}%`;

            const item = new PopupMenu.PopupMenuItem(props.model);
            const batteryLabel = new St.Label({
                text: batteryText,
                style_class: 'bluetooth-device-battery-level',
                y_align: Clutter.ActorAlign.CENTER,
            });
            item.add_child(batteryLabel);
            this.menu.addMenuItem(item);
        }

        if (!hasDevices) {
            const noDevices = new PopupMenu.PopupMenuItem('No devices found');
            noDevices.setSensitive(false);
            this.menu.addMenuItem(noDevices);
        }
    }

    _startPolling() {
        const interval = this._settings.get_int('update-interval') * 60;
        this._pollSourceId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            interval,
            () => {
                this._refresh();
                return GLib.SOURCE_CONTINUE;
            },
        );
    }

    destroy() {
        if (this._pollSourceId) {
            GLib.source_remove(this._pollSourceId);
            this._pollSourceId = null;
        }
        for (const {obj, id} of this._signalIds)
            obj.disconnect(id);
        this._signalIds = [];
        super.destroy();
    }
});

export default class BluetoothBatteryMonitorExtension extends Extension {
    enable() {
        this._indicator = new BluetoothBatteryIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
