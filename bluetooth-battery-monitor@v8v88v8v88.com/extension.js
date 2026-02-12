import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const UPOWER_BUS = 'org.freedesktop.UPower';
const UPOWER_PATH = '/org/freedesktop/UPower';
const UPOWER_IFACE = 'org.freedesktop.UPower';
const DEVICE_IFACE = 'org.freedesktop.UPower.Device';
const PROPERTIES_IFACE = 'org.freedesktop.DBus.Properties';

const DEVICE_TYPE_LINE_POWER = 1;
const DEVICE_TYPE_BATTERY = 2;

function drawBatteryVertical(cr, width, height, percentage, panelFg) {
    const pct = Math.max(0, Math.min(100, percentage));
    const capH = 2;
    const capW = width * 0.4;
    const bodyY = capH;
    const bodyW = width;
    const bodyH = height - capH;
    const r = 2;
    const lw = 1.2;

    cr.setLineWidth(lw);
    cr.setSourceRGBA(panelFg[0], panelFg[1], panelFg[2], 0.85);

    cr.rectangle((bodyW - capW) / 2, 0, capW, capH);
    cr.fill();

    const half = lw / 2;
    const bx = half;
    const by = bodyY + half;
    const bw = bodyW - lw;
    const bh = bodyH - lw;

    cr.newSubPath();
    cr.arc(bx + r, by + r, r, Math.PI, 1.5 * Math.PI);
    cr.arc(bx + bw - r, by + r, r, 1.5 * Math.PI, 0);
    cr.arc(bx + bw - r, by + bh - r, r, 0, 0.5 * Math.PI);
    cr.arc(bx + r, by + bh - r, r, 0.5 * Math.PI, Math.PI);
    cr.closePath();
    cr.stroke();

    const pad = lw + 1;
    const fillMaxW = bodyW - pad * 2;
    const fillMaxH = bodyH - pad * 2;
    const fillH = Math.round(fillMaxH * (pct / 100));

    if (pct > 50)
        cr.setSourceRGBA(0.3, 0.85, 0.35, 1);
    else if (pct > 20)
        cr.setSourceRGBA(1, 0.75, 0.1, 1);
    else
        cr.setSourceRGBA(1, 0.2, 0.2, 1);

    if (fillH > 0)
        cr.rectangle(pad, bodyY + pad + (fillMaxH - fillH), fillMaxW, fillH);
    cr.fill();
}

function drawBatteryHorizontal(cr, width, height, percentage, panelFg) {
    const pct = Math.max(0, Math.min(100, percentage));
    const bodyW = width - 3;
    const bodyH = height;
    const r = 2;
    const lw = 1.2;

    cr.setLineWidth(lw);
    cr.setSourceRGBA(panelFg[0], panelFg[1], panelFg[2], 0.85);

    const half = lw / 2;
    cr.newSubPath();
    cr.arc(half + r, half + r, r, Math.PI, 1.5 * Math.PI);
    cr.arc(bodyW - half - r, half + r, r, 1.5 * Math.PI, 0);
    cr.arc(bodyW - half - r, bodyH - half - r, r, 0, 0.5 * Math.PI);
    cr.arc(half + r, bodyH - half - r, r, 0.5 * Math.PI, Math.PI);
    cr.closePath();
    cr.stroke();

    const nubH = bodyH * 0.4;
    cr.rectangle(bodyW, (bodyH - nubH) / 2, 2, nubH);
    cr.fill();

    const pad = lw + 1;
    const fillMaxW = bodyW - pad * 2;
    const fillMaxH = bodyH - pad * 2;
    const fillW = Math.round(fillMaxW * (pct / 100));

    if (pct > 50)
        cr.setSourceRGBA(0.3, 0.85, 0.35, 1);
    else if (pct > 20)
        cr.setSourceRGBA(1, 0.75, 0.1, 1);
    else
        cr.setSourceRGBA(1, 0.2, 0.2, 1);

    if (fillW > 0)
        cr.rectangle(pad, pad, fillW, fillMaxH);
    cr.fill();
}

const BluetoothBatteryIndicator = GObject.registerClass(
    class BluetoothBatteryIndicator extends PanelMenu.Button {
        _init(extensionObj) {
            super._init(0.0, 'Bluetooth Battery Monitor');

            this._settings = extensionObj.getSettings();
            this._primaryPercentage = -1;
            this._panelFg = [1, 1, 1];
            this._proxyCache = new Map();
            this._bluetoothIndicator = null;
            this._bluetoothIndicatorVisible = null;

            this._box = new St.BoxLayout({
                style_class: 'panel-status-indicators-box',
            });
            this.add_child(this._box);

            this._btIcon = new St.Icon({
                icon_name: 'bluetooth-active-symbolic',
                style_class: 'system-status-icon bluetooth-battery-bt-icon',
            });
            this._box.add_child(this._btIcon);

            this._batteryIcon = new St.DrawingArea({
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'bluetooth-battery-vertical-icon',
            });
            this._batteryIcon.set_size(10, 16);
            this._batteryIcon.connect('repaint', (area) => {
                const cr = area.get_context();
                const [w, h] = area.get_surface_size();
                drawBatteryVertical(cr, w, h, this._primaryPercentage, this._panelFg);
                cr.$dispose();
            });
            this._box.add_child(this._batteryIcon);

            this._percentLabel = new St.Label({
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'bluetooth-battery-panel-label',
                visible: false,
            });
            this._box.add_child(this._percentLabel);

            this.connect('notify::hover', () => {
                if (this._primaryPercentage >= 0)
                    this._updatePercentVisibility();
            });

            this._signalIds = [];
            this._setupUPowerProxy();
            this._refresh();
            this._startPolling();

            this._settingsChangedId = this._settings.connect('changed::update-interval', () => {
                this._restartPolling();
            });
            this._percentVisibilityIds = [
                this._settings.connect('changed::show-hover-percentage', () => this._updatePercentVisibility()),
                this._settings.connect('changed::always-show-percentage', () => this._updatePercentVisibility()),
            ];

            const quickSettings = Main.panel.statusArea.quickSettings;
            const bluetooth = quickSettings?._bluetooth;
            const indicatorActor = bluetooth?._indicator ?? bluetooth?.container ?? null;
            if (indicatorActor) {
                this._bluetoothIndicator = indicatorActor;
                this._bluetoothIndicatorVisible = this._bluetoothIndicator.visible;
                this._updateBluetoothIconVisibility();
                this._bluetoothVisibilityId = this._settings.connect(
                    'changed::hide-original-bluetooth-icon',
                    () => this._updateBluetoothIconVisibility(),
                );
            }
        }

        _updatePercentVisibility() {
            if (this._primaryPercentage < 0)
                return;
            const always = this._settings.get_boolean('always-show-percentage');
            const hover = this._settings.get_boolean('show-hover-percentage');
            this._percentLabel.visible = always || (hover && this.hover);
        }

        _updateBluetoothIconVisibility() {
            if (!this._bluetoothIndicator)
                return;
            const hide = this._settings.get_boolean('hide-original-bluetooth-icon');
            this._bluetoothIndicator.visible = !hide;
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
                if (signal === 'DeviceAdded' || signal === 'DeviceRemoved') {
                    this._proxyCache.clear();
                    this._refresh();
                }
            });
            this._signalIds.push({ obj: this._upower, id });
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

        _getPropertiesProxy(objectPath) {
            let proxy = this._proxyCache.get(objectPath);
            if (proxy)
                return proxy;

            proxy = Gio.DBusProxy.new_for_bus_sync(
                Gio.BusType.SYSTEM,
                Gio.DBusProxyFlags.NONE,
                null,
                UPOWER_BUS,
                objectPath,
                PROPERTIES_IFACE,
                null,
            );
            this._proxyCache.set(objectPath, proxy);
            return proxy;
        }

        _getDeviceProperties(objectPath) {
            try {
                const proxy = this._getPropertiesProxy(objectPath);
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
                this._proxyCache.delete(objectPath);
                return null;
            }
        }

        _refresh() {
            this.menu.removeAll();

            const devicePaths = this._enumerateDevices();
            const devices = [];

            for (const path of devicePaths) {
                const props = this._getDeviceProperties(path);
                if (!props || !props.isPresent)
                    continue;
                if (props.type === DEVICE_TYPE_LINE_POWER || props.type === DEVICE_TYPE_BATTERY)
                    continue;
                devices.push(props);
            }

            if (devices.length === 0) {
                this.visible = false;
                return;
            }

            this.visible = true;

            const lowest = devices.reduce((a, b) =>
                a.percentage <= b.percentage ? a : b);
            this._primaryPercentage = Math.round(lowest.percentage);

            this._percentLabel.text = `${this._primaryPercentage}%`;
            this._updatePercentVisibility();
            this._batteryIcon.queue_repaint();

            for (const dev of devices) {
                const pct = Math.round(dev.percentage);
                const item = new PopupMenu.PopupBaseMenuItem();

                const nameLabel = new St.Label({
                    text: dev.model,
                    y_align: Clutter.ActorAlign.CENTER,
                    x_expand: true,
                });
                item.add_child(nameLabel);

                const batteryArea = new St.DrawingArea({
                    y_align: Clutter.ActorAlign.CENTER,
                });
                batteryArea.set_size(20, 10);
                batteryArea.connect('repaint', (area) => {
                    const cr = area.get_context();
                    const [w, h] = area.get_surface_size();
                    drawBatteryHorizontal(cr, w, h, pct, this._panelFg);
                    cr.$dispose();
                });
                item.add_child(batteryArea);

                const pctLabel = new St.Label({
                    text: `${pct}%`,
                    y_align: Clutter.ActorAlign.CENTER,
                    style_class: 'bluetooth-battery-menu-percent',
                });
                item.add_child(pctLabel);

                item.connect('activate', () => {
                    const subprocess = new Gio.Subprocess({
                        argv: ['gnome-control-center', 'bluetooth'],
                        flags: Gio.SubprocessFlags.NONE,
                    });
                    subprocess.init(null);
                });

                this.menu.addMenuItem(item);
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

        _restartPolling() {
            if (this._pollSourceId) {
                GLib.source_remove(this._pollSourceId);
                this._pollSourceId = null;
            }
            this._startPolling();
        }

        destroy() {
            if (this._settingsChangedId) {
                this._settings.disconnect(this._settingsChangedId);
                this._settingsChangedId = null;
            }
            if (this._percentVisibilityIds) {
                for (const id of this._percentVisibilityIds)
                    this._settings.disconnect(id);
                this._percentVisibilityIds = null;
            }
            if (this._bluetoothVisibilityId) {
                this._settings.disconnect(this._bluetoothVisibilityId);
                this._bluetoothVisibilityId = null;
            }
            if (this._bluetoothIndicator && this._bluetoothIndicatorVisible !== null)
                this._bluetoothIndicator.visible = this._bluetoothIndicatorVisible;

            if (this._pollSourceId) {
                GLib.source_remove(this._pollSourceId);
                this._pollSourceId = null;
            }
            for (const { obj, id } of this._signalIds)
                obj.disconnect(id);
            this._signalIds = [];
            this._proxyCache.clear();
            this._upower = null;
            super.destroy();
        }
    });

export default class BluetoothBatteryMonitorExtension extends Extension {
    enable() {
        this._indicator = new BluetoothBatteryIndicator(this);

        const quickSettings = Main.panel.statusArea.quickSettings;
        let position = 0;

        if (quickSettings) {
            const rightBox = Main.panel._rightBox;
            const children = rightBox.get_children();
            const qsIndex = children.indexOf(quickSettings.container);
            if (qsIndex >= 0)
                position = qsIndex;
        }

        Main.panel.addToStatusArea(this.uuid, this._indicator, position);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
