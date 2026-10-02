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

const BLUEZ_BUS = 'org.bluez';
const BLUEZ_ROOT = '/';
const OBJECT_MANAGER_IFACE = 'org.freedesktop.DBus.ObjectManager';
const BLUEZ_DEVICE_IFACE = 'org.bluez.Device1';

const DEVICE_TYPE_LINE_POWER = 1;
const DEVICE_TYPE_BATTERY = 2;

const MAJOR_AUDIO = 0x04;
const MAJOR_PERIPHERAL = 0x05;
const MINOR_HEADPHONES = 0x01;
const MINOR_LOUDSPEAKER = 0x04;
const MINOR_HEADSET = 0x05;
const MINOR_GAMEPAD = 0x04;

const DEVICE_ICONS = {
    headphone: 'audio-headphones-symbolic',
    speaker: 'audio-speakers-symbolic',
    controller: 'input-gaming-symbolic',
    mouse: 'input-mouse-symbolic',
    keyboard: 'input-keyboard-symbolic',
    phone: 'phone-symbolic',
    tv: 'video-display-symbolic',
    tablet: 'computer-symbolic',
    watch: 'preferences-system-time-symbolic',
    car: 'bluetooth-active-symbolic',
    unknown: 'bluetooth-active-symbolic',
};

const NAME_KEYWORDS = {
    controller: [
        'controller', 'gamepad', 'joystick',
        'xbox', 'playstation', 'dualshock', 'dualsense',
        'wireless controller', 'nintendo joy', 'pro controller',
        'steam deck', '8bitdo', 'gamesir',
        'razer wolverine', 'razer raiju', 'thrustmaster',
    ],
    speaker: [
        'speaker', 'soundbar', 'xsound', 'tribit',
        'jbl flip', 'jbl charge', 'jbl xtreme', 'jbl clip',
        'jbl go', 'jbl link', 'jbl partybox', 'jbl boombox',
        'bose soundlink', 'bose revolve', 'anker soundcore',
        'ue boom', 'ue megaboom',
        'marshall emberton', 'marshall stockwell', 'marshall kilburn',
        'harman kardon', 'edifier', 'creative', 'bang olufsen',
        'w-king', 'doss', 'otium', 'comiso',
        'go speaker', 'wireless speaker', 'portable speaker',
        'sony srs', 'logitech z',
    ],
    headphone: [
        'headphone', 'headset', 'earphone', 'earbud',
        'airpod', 'galaxy bud', 'pixel bud',
        'jabra elite', 'sennheiser', 'audio technica',
        'beats', 'skullcandy', 'hyperx cloud',
        'razer kraken', 'razer barracuda',
        'sony wh-', 'sony wf-',
        'bose qc', 'bose nc',
        'jbl tune', 'jbl live', 'jbl reflect',
        'nothing ear',
        'oneplus bud', 'realme bud', 'oppo enco',
        'boat rockerz', 'boat airdopes', 'boat bass',
        'noise buds', 'noise ear',
        'poco bud',
        'soundcore', 'logitech g pro',
    ],
    mouse: [
        'mouse', 'mice', 'trackball',
        'logitech m', 'mx master', 'mx anywhere',
        'm185', 'm221', 'm330', 'm337', 'm720',
        'microsoft arc mouse', 'razer deathadder', 'hp z3700',
        'wireless mouse', 'bluetooth mouse',
    ],
    keyboard: [
        'keyboard', 'keypad',
        'k380', 'k480', 'k780', 'k400',
        'mx keys', 'magic keyboard', 'logitech k',
        'microsoft surface keyboard', 'keychron',
        'wireless keyboard', 'bluetooth keyboard',
    ],
    phone: [
        'phone', 'iphone', 'android', 'smartphone', 'mobile',
        'galaxy s', 'galaxy a', 'galaxy z', 'galaxy note',
        'pixel ', 'oneplus', 'oppo', 'vivo', 'realme',
        'redmi', 'xiaomi', 'motorola', 'nokia',
        'asus rog phone', 'samsung galaxy',
        'poco', 'iqoo', 'infinix', 'tecno', 'honor',
    ],
    tv: [
        'tv', 'television',
        'roku', 'fire tv', 'fire stick',
        'android tv', 'smart tv',
        'chromecast', 'apple tv',
        'mi tv', 'hisense',
    ],
    tablet: [
        'tablet', 'ipad', 'galaxy tab',
        'surface go', 'surface pro',
        'kindle', 'amazon fire',
    ],
    watch: [
        'watch', 'wear os',
        'galaxy watch', 'apple watch',
        'fitbit', 'garmin', 'amazfit',
        'xiaomi watch', 'mi band',
        'smartwatch',
        'huawei watch', 'oppo watch', 'oneplus watch',
        'fossil gen',
    ],
    car: [
        'car', 'automotive', 'vehicle',
        'bmw', 'tesla', 'ford', 'toyota',
        'honda', 'hyundai', 'maruti',
    ],
};

const NAME_TYPE_ORDER = [
    'controller',
    'speaker',
    'headphone',
    'mouse',
    'keyboard',
    'phone',
    'tv',
    'tablet',
    'watch',
    'car',
];

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

function macFromUPowerPath(path) {
    const match = path.match(/_dev_([0-9a-fA-F]{2}_[0-9a-fA-F]{2}_[0-9a-fA-F]{2}_[0-9a-fA-F]{2}_[0-9a-fA-F]{2}_[0-9a-fA-F]{2})$/i)
        || path.match(/bluetooth_([0-9a-fA-F_]{17})$/i);
    if (!match)
        return null;
    return match[1].replace(/_/g, ':').toLowerCase();
}

function deviceTypeFromBlueZ(cod, icon) {
    if (icon) {
        const i = icon.toLowerCase();
        if (i.includes('speaker') || i.includes('audio-card'))
            return 'speaker';
        if (i.includes('headphone') || i.includes('headset'))
            return 'headphone';
        if (i.includes('gaming') || i.includes('gamepad') || i.includes('joystick'))
            return 'controller';
        if (i.includes('mouse') || i.includes('input-mouse'))
            return 'mouse';
        if (i.includes('keyboard') || i.includes('input-keyboard'))
            return 'keyboard';
        if (i.includes('phone') || i.includes('smartphone'))
            return 'phone';
        if (i.includes('video') || i.includes('display') || i.includes('tv'))
            return 'tv';
        if (i.includes('tablet'))
            return 'tablet';
        if (i.includes('watch') || i.includes('wearable'))
            return 'watch';
    }
    if (cod !== undefined && cod !== null) {
        const major = (cod >> 8) & 0x1f;
        const minor = (cod >> 2) & 0x3f;
        if (major === MAJOR_PERIPHERAL && minor === MINOR_GAMEPAD)
            return 'controller';
        if (major === MAJOR_AUDIO) {
            if (minor === MINOR_LOUDSPEAKER)
                return 'speaker';
            if (minor === MINOR_HEADPHONES || minor === MINOR_HEADSET || minor >= 0x05 && minor <= 0x07)
                return 'headphone';
        }
    }
    return null;
}

function deviceTypeFromName(model) {
    if (!model)
        return null;
    const m = model.toLowerCase();

    for (const type of NAME_TYPE_ORDER) {
        const keywords = NAME_KEYWORDS[type];
        if (keywords?.some(k => m.includes(k)))
            return type;
    }

    return null;
}

function iconForDeviceType(type) {
    return DEVICE_ICONS[type] || DEVICE_ICONS.headphone;
}

function deviceTypeFromOverrides(model, overrides) {
    if (!model || !overrides || overrides.length === 0)
        return null;
    const m = model.toLowerCase().trim();
    for (const entry of overrides) {
        const idx = entry.lastIndexOf('|');
        if (idx <= 0)
            continue;
        const storedModel = entry.slice(0, idx).toLowerCase().trim();
        const storedType = entry.slice(idx + 1).trim();
        if (storedModel && storedType && m === storedModel)
            return storedType;
    }
    return null;
}

const BluetoothBatteryIndicator = GObject.registerClass(
    class BluetoothBatteryIndicator extends PanelMenu.Button {
        _init(extensionObj) {
            super._init(0.0, 'Bluetooth Battery Monitor');

            this.add_style_class_name('bluetooth-battery-panel-button');

            this._settings = extensionObj.getSettings();
            this._primaryPercentage = -1;
            this._primaryDeviceType = 'unknown';
            this._proxyCache = new Map();
            this._bluezCache = null;
            this._bluetoothIndicator = null;
            this._bluetoothIndicatorVisible = null;
            this._bluetoothIndicatorSignalId = null;

            this._box = new St.BoxLayout({
                style_class: 'panel-status-indicators-box bluetooth-battery-box',
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
                const themeNode = area.get_theme_node();
                const color = themeNode.get_foreground_color();
                const panelFg = [color.red / 255, color.green / 255, color.blue / 255];
                drawBatteryVertical(cr, w, h, this._primaryPercentage, panelFg);
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
                this._settings.connect('changed::device-overrides', () => this._refresh()),
                this._settings.connect('changed::hpadding', () => this._updateStyle()),
                this._settings.connect('changed::outer-margin', () => this._updateStyle()),
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
            if (hide) {
                if (!this._bluetoothIndicatorSignalId) {
                    this._bluetoothIndicatorSignalId = this._bluetoothIndicator.connect('notify::visible', () => {
                        if (this._settings.get_boolean('hide-original-bluetooth-icon') && this._bluetoothIndicator.visible)
                            this._bluetoothIndicator.visible = false;
                    });
                }
            } else if (this._bluetoothIndicatorSignalId) {
                this._bluetoothIndicator.disconnect(this._bluetoothIndicatorSignalId);
                this._bluetoothIndicatorSignalId = null;
            }
        }

        _updateStyle() {
            const hpadding = this._settings.get_int('hpadding');
            const outerMargin = Math.max(0, this._settings.get_int('outer-margin'));
            this.style = `-natural-hpadding: ${hpadding}px; -minimum-hpadding: ${Math.max(0, Math.floor(hpadding / 2))}px; margin-left: ${outerMargin}px; margin-right: ${outerMargin}px;`;
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
                    this._bluezCache = null;
                    this._refresh();
                }
            });
            this._signalIds.push({ obj: this._upower, id });
        }

        _getBlueZDeviceMap() {
            if (this._bluezCache)
                return this._bluezCache;
            const map = new Map();
            try {
                const connection = Gio.bus_get_sync(Gio.BusType.SYSTEM, null);
                const ownerResult = connection.call_sync(
                    'org.freedesktop.DBus',
                    '/org/freedesktop/DBus',
                    'org.freedesktop.DBus',
                    'NameHasOwner',
                    new GLib.Variant('(s)', [BLUEZ_BUS]),
                    new GLib.VariantType('(b)'),
                    Gio.DBusCallFlags.NONE,
                    -1,
                    null
                );
                const hasOwner = ownerResult.deep_unpack()[0];
                if (!hasOwner) {
                    this._bluezCache = map;
                    return map;
                }

                const proxy = Gio.DBusProxy.new_for_bus_sync(
                    Gio.BusType.SYSTEM,
                    Gio.DBusProxyFlags.DO_NOT_AUTO_START,
                    null,
                    BLUEZ_BUS,
                    BLUEZ_ROOT,
                    OBJECT_MANAGER_IFACE,
                    null,
                );
                const result = proxy.call_sync(
                    'GetManagedObjects',
                    null,
                    Gio.DBusCallFlags.NONE,
                    -1,
                    null,
                );
                const objects = result.deep_unpack()[0];
                for (const path of Object.keys(objects)) {
                    const interfaces = objects[path];
                    const dev = interfaces?.[BLUEZ_DEVICE_IFACE];
                    if (!dev)
                        continue;
                    const connected = dev.Connected?.deep_unpack?.() ?? dev.Connected;
                    if (!connected)
                        continue;
                    const addr = dev.Address?.deep_unpack?.() ?? dev.Address;
                    if (!addr)
                        continue;
                    const key = String(addr).toLowerCase().replace(/:/g, '_');
                    const cod = dev.Class?.deep_unpack?.() ?? dev.Class;
                    const icon = dev.Icon?.deep_unpack?.() ?? dev.Icon;
                    map.set(key, { cod, icon });
                }
            } catch (e) {
                if (!e.message?.includes('not found'))
                    console.error(`BluetoothBatteryMonitor BlueZ: ${e.message}`);
            }
            this._bluezCache = map;
            return map;
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
                    nativePath: objectPath,
                };
            } catch (_e) {
                this._proxyCache.delete(objectPath);
                return null;
            }
        }

        _refresh() {
            this.menu.removeAll();
            this._bluezCache = null;

            const devicePaths = this._enumerateDevices();
            const devices = [];
            const bluezMap = this._getBlueZDeviceMap();

            for (const path of devicePaths) {
                const props = this._getDeviceProperties(path);
                if (!props || !props.isPresent)
                    continue;
                if (props.type === DEVICE_TYPE_LINE_POWER || props.type === DEVICE_TYPE_BATTERY)
                    continue;

                const mac = macFromUPowerPath(path);
                let deviceType = 'unknown';

                const overrides = this._settings.get_strv('device-overrides');
                const overrideType = deviceTypeFromOverrides(props.model, overrides);
                if (overrideType) {
                    deviceType = overrideType;
                } else {
                    const nameType = deviceTypeFromName(props.model);
                    if (nameType) {
                        deviceType = nameType;
                    } else if (mac) {
                        const key = mac.replace(/:/g, '_');
                        const bluez = bluezMap.get(key);
                        if (bluez) {
                            const bluezType = deviceTypeFromBlueZ(bluez.cod, bluez.icon);
                            deviceType = bluezType ?? 'headphone';
                        }
                    }
                }

                devices.push({ ...props, deviceType });
            }

            if (devices.length === 0) {
                this.visible = false;
                this._updateStyle();
                return;
            }

            this.visible = true;
            this._updateStyle();

            const lowest = devices.reduce((a, b) =>
                a.percentage <= b.percentage ? a : b);
            this._primaryPercentage = Math.round(lowest.percentage);
            this._primaryDeviceType = lowest.deviceType;

            this._btIcon.icon_name = iconForDeviceType(this._primaryDeviceType);
            this._percentLabel.text = `${this._primaryPercentage}%`;
            this._updatePercentVisibility();
            this._batteryIcon.queue_repaint();

            for (const dev of devices) {
                const pct = Math.round(dev.percentage);
                const item = new PopupMenu.PopupBaseMenuItem();

                const typeIcon = new St.Icon({
                    icon_name: iconForDeviceType(dev.deviceType),
                    style_class: 'system-status-icon bluetooth-battery-menu-device-icon',
                    y_align: Clutter.ActorAlign.CENTER,
                });
                typeIcon.set_icon_size(16);
                item.add_child(typeIcon);

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
                    const themeNode = area.get_theme_node();
                    const color = themeNode.get_foreground_color();
                    const panelFg = [color.red / 255, color.green / 255, color.blue / 255];
                    drawBatteryHorizontal(cr, w, h, pct, panelFg);
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
            if (this._bluetoothIndicator && this._bluetoothIndicatorSignalId) {
                this._bluetoothIndicator.disconnect(this._bluetoothIndicatorSignalId);
                this._bluetoothIndicatorSignalId = null;
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
        this._settings = this.getSettings();
        this._positionChangedId = this._settings.connect('changed::position-box', () => this._reposition());
        this._indexChangedId = this._settings.connect('changed::position-index', () => this._reposition());
        this._reposition();
    }

    _reposition() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        this._indicator = new BluetoothBatteryIndicator(this);

        const box = this._settings.get_string('position-box') || 'right';
        let index = this._settings.get_int('position-index');

        if (index === -1) {
            index = 0;
            if (box === 'right') {
                const quickSettings = Main.panel.statusArea.quickSettings;
                if (quickSettings) {
                    const rightBox = Main.panel._rightBox;
                    const children = rightBox.get_children();
                    const qsIndex = children.indexOf(quickSettings.container);
                    if (qsIndex >= 0)
                        index = qsIndex;
                }
            }
        }

        Main.panel.addToStatusArea(this.uuid, this._indicator, index, box);
    }

    disable() {
        if (this._positionChangedId) {
            this._settings.disconnect(this._positionChangedId);
            this._positionChangedId = null;
        }
        if (this._indexChangedId) {
            this._settings.disconnect(this._indexChangedId);
            this._indexChangedId = null;
        }
        this._settings = null;

        this._indicator?.destroy();
        this._indicator = null;
    }
}
