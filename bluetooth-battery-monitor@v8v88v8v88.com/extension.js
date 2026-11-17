import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

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

const LOGIN_BUS = 'org.freedesktop.login1';
const LOGIN_PATH = '/org/freedesktop/login1';
const LOGIN_MANAGER_IFACE = 'org.freedesktop.login1.Manager';

const DEVICE_TYPE_LINE_POWER = 1;
const DEVICE_TYPE_BATTERY = 2;

const BATTERY_TYPE_PERCENTAGE = 1;

const MAJOR_AUDIO = 0x04;
const MAJOR_PERIPHERAL = 0x05;
const MINOR_HEADPHONES = 0x01;
const MINOR_LOUDSPEAKER = 0x04;
const MINOR_HEADSET = 0x05;
const MINOR_GAMEPAD = 0x04;

const DEVICE_ICONS = {
    bluetooth: ['bluetooth-active-symbolic'],
    headphone: ['audio-headphones-symbolic'],
    speaker: ['audio-speakers-symbolic'],
    controller: ['input-gaming-symbolic'],
    mouse: ['input-mouse-symbolic'],
    keyboard: ['input-keyboard-symbolic'],
    phone: ['phone-apple-iphone-symbolic', 'phone-symbolic'],
    tv: ['tv-symbolic', 'video-display-symbolic'],
    tablet: ['tablet-symbolic', 'computer-symbolic'],
    unknown: ['bluetooth-active-symbolic'],
};

const BUNDLED_ICONS = new Set(['earbuds', 'car', 'watch']);

let bundledIconsDir = null;

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
    earbuds: [
        'earbud', 'buds', 'airpod', 'freebuds', 'tws',
        'galaxy bud', 'pixel bud', 'oneplus bud', 'realme bud', 'poco bud',
        'jabra elite', 'sony wf-', 'nothing ear', 'oppo enco',
        'boat airdopes', 'noise ear', 'earfun',
    ],
    headphone: [
        'headphone', 'headset', 'earphone',
        'sennheiser', 'audio technica',
        'beats', 'skullcandy', 'hyperx cloud',
        'razer kraken', 'razer barracuda',
        'sony wh-',
        'bose qc', 'bose nc',
        'jbl tune', 'jbl live', 'jbl reflect',
        'boat rockerz', 'boat bass',
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
    'earbuds',
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
    if (BUNDLED_ICONS.has(type) && bundledIconsDir)
        return new Gio.FileIcon({file: bundledIconsDir.get_child(`${type}-symbolic.svg`)});
    return new Gio.ThemedIcon({names: DEVICE_ICONS[type] ?? DEVICE_ICONS.headphone});
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

function repaintBattery(area, percentage, draw) {
    const cr = area.get_context();
    const [w, h] = area.get_surface_size();
    const color = area.get_theme_node().get_foreground_color();
    const fg = [color.red / 255, color.green / 255, color.blue / 255];
    draw(cr, w, h, percentage, fg);
    cr.$dispose();
}

class BatteryMonitor {
    constructor(settings) {
        this._settings = settings;
        this._proxyCache = new Map();
        this._listeners = new Set();
        this.devices = [];

        this._upower = Gio.DBusProxy.new_for_bus_sync(
            Gio.BusType.SYSTEM,
            Gio.DBusProxyFlags.NONE,
            null,
            UPOWER_BUS,
            UPOWER_PATH,
            UPOWER_IFACE,
            null,
        );
        this._upowerSignalId = this._upower.connect('g-signal', (_proxy, _sender, signal) => {
            if (signal === 'DeviceAdded' || signal === 'DeviceRemoved') {
                this._proxyCache.clear();
                this.refresh();
            }
        });

        this._settingsIds = [
            this._settings.connect('changed::update-interval', () => this._startPolling()),
            this._settings.connect('changed::device-overrides', () => this.refresh()),
        ];

        const systemBus = Gio.DBus.system;
        this._busSubscriptions = [
            systemBus.signal_subscribe(
                BLUEZ_BUS,
                PROPERTIES_IFACE,
                'PropertiesChanged',
                null,
                BLUEZ_DEVICE_IFACE,
                Gio.DBusSignalFlags.NONE,
                (_conn, _sender, _path, _iface, _signal, params) => {
                    const [, changed] = params.deep_unpack();
                    if ('Connected' in changed)
                        this._queueRefresh(1000);
                }),
            systemBus.signal_subscribe(
                LOGIN_BUS,
                LOGIN_MANAGER_IFACE,
                'PrepareForSleep',
                LOGIN_PATH,
                null,
                Gio.DBusSignalFlags.NONE,
                (_conn, _sender, _path, _iface, _signal, params) => {
                    const [goingToSleep] = params.deep_unpack();
                    if (!goingToSleep)
                        this._queueRefresh(3000);
                }),
        ];

        this._startPolling();
        this.refresh();
    }

    _queueRefresh(delayMs) {
        if (this._refreshSourceId)
            GLib.source_remove(this._refreshSourceId);
        this._refreshSourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
            this._refreshSourceId = null;
            this.refresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    addListener(fn) {
        this._listeners.add(fn);
        fn(this.devices);
        return fn;
    }

    removeListener(fn) {
        this._listeners.delete(fn);
    }

    devicesByMac() {
        const map = new Map();
        for (const dev of this.devices) {
            if (dev.mac)
                map.set(dev.mac, dev);
        }
        return map;
    }

    _startPolling() {
        if (this._pollSourceId)
            GLib.source_remove(this._pollSourceId);
        const interval = Math.max(1, this._settings.get_int('update-interval')) * 60;
        this._pollSourceId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, interval, () => {
            this.refresh();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _getBlueZDeviceMap() {
        const map = new Map();
        const known = new Set();
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
                null,
            );
            if (!ownerResult.deep_unpack()[0])
                return null;

            const proxy = Gio.DBusProxy.new_for_bus_sync(
                Gio.BusType.SYSTEM,
                Gio.DBusProxyFlags.DO_NOT_AUTO_START,
                null,
                BLUEZ_BUS,
                BLUEZ_ROOT,
                OBJECT_MANAGER_IFACE,
                null,
            );
            const result = proxy.call_sync('GetManagedObjects', null, Gio.DBusCallFlags.NONE, -1, null);
            const objects = result.deep_unpack()[0];
            for (const path of Object.keys(objects)) {
                const dev = objects[path]?.[BLUEZ_DEVICE_IFACE];
                if (!dev)
                    continue;
                const addr = dev.Address?.deep_unpack?.() ?? dev.Address;
                if (!addr)
                    continue;
                const key = String(addr).toLowerCase().replace(/:/g, '_');
                known.add(key);
                const connected = dev.Connected?.deep_unpack?.() ?? dev.Connected;
                if (!connected)
                    continue;
                const cod = dev.Class?.deep_unpack?.() ?? dev.Class;
                const icon = dev.Icon?.deep_unpack?.() ?? dev.Icon;
                map.set(key, {cod, icon});
            }
        } catch (e) {
            if (!e.message?.includes('not found'))
                console.error(`BluetoothBatteryMonitor BlueZ: ${e.message}`);
            return null;
        }
        return {connected: map, known};
    }

    _enumerateDevices() {
        try {
            const result = this._upower.call_sync('EnumerateDevices', null, Gio.DBusCallFlags.NONE, -1, null);
            return result.deep_unpack()[0];
        } catch (e) {
            console.error(`BluetoothBatteryMonitor: ${e.message}`);
            return [];
        }
    }

    _getDeviceProperties(objectPath) {
        try {
            let proxy = this._proxyCache.get(objectPath);
            if (!proxy) {
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
            }
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

    refresh() {
        if (!this._upower)
            return;

        const bluez = this._getBlueZDeviceMap();
        const overrides = this._settings.get_strv('device-overrides');
        const devices = [];

        for (const path of this._enumerateDevices()) {
            const props = this._getDeviceProperties(path);
            if (!props || !props.isPresent)
                continue;
            if (props.type === DEVICE_TYPE_LINE_POWER || props.type === DEVICE_TYPE_BATTERY)
                continue;

            const mac = macFromUPowerPath(path);
            const bluezKey = mac?.replace(/:/g, '_');
            if (bluez && bluezKey && bluez.known.has(bluezKey) && !bluez.connected.has(bluezKey))
                continue;

            let deviceType = deviceTypeFromOverrides(props.model, overrides) ??
                deviceTypeFromName(props.model);
            if (!deviceType && bluezKey) {
                const info = bluez?.connected.get(bluezKey);
                if (info)
                    deviceType = deviceTypeFromBlueZ(info.cod, info.icon) ?? 'headphone';
            }

            devices.push({...props, mac, deviceType: deviceType ?? 'unknown'});
        }

        this.devices = devices;
        for (const fn of this._listeners)
            fn(devices);
    }

    destroy() {
        if (this._pollSourceId) {
            GLib.source_remove(this._pollSourceId);
            this._pollSourceId = null;
        }
        if (this._refreshSourceId) {
            GLib.source_remove(this._refreshSourceId);
            this._refreshSourceId = null;
        }
        for (const id of this._busSubscriptions ?? [])
            Gio.DBus.system.signal_unsubscribe(id);
        this._busSubscriptions = [];
        for (const id of this._settingsIds)
            this._settings.disconnect(id);
        this._settingsIds = [];
        if (this._upower && this._upowerSignalId)
            this._upower.disconnect(this._upowerSignalId);
        this._upower = null;
        this._proxyCache.clear();
        this._listeners.clear();
        this.devices = [];
    }
}

class PanelBatteryWidgets {
    constructor(box, settings) {
        this._settings = settings;
        this._percentage = -1;
        this._hoverActor = null;
        this._hoverId = null;

        this._btIcon = new St.Icon({
            icon_name: 'bluetooth-active-symbolic',
            style_class: 'system-status-icon bluetooth-battery-bt-icon',
        });
        box.add_child(this._btIcon);

        this._batteryIcon = new St.DrawingArea({
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'bluetooth-battery-vertical-icon',
        });
        this._batteryIcon.set_size(10, 16);
        this._batteryIcon.connect('repaint', area =>
            repaintBattery(area, this._percentage, drawBatteryVertical));
        box.add_child(this._batteryIcon);

        this._percentLabel = new St.Label({
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'bluetooth-battery-panel-label',
            visible: false,
        });
        box.add_child(this._percentLabel);

        this._settingsIds = [
            this._settings.connect('changed::show-hover-percentage', () => this.updatePercentVisibility()),
            this._settings.connect('changed::always-show-percentage', () => this.updatePercentVisibility()),
        ];
    }

    setHoverActor(actor) {
        if (this._hoverActor && this._hoverId)
            this._hoverActor.disconnect(this._hoverId);
        if (this._hoverMenu && this._menuOpenId)
            this._hoverMenu.disconnect(this._menuOpenId);
        this._hoverActor = actor;
        this._hoverMenu = actor?.menu ?? null;
        this._hoverId = actor?.connect('notify::hover', () => this.updatePercentVisibility()) ?? null;
        this._menuOpenId = this._hoverMenu?.connect('open-state-changed', () => this.updatePercentVisibility()) ?? null;
    }

    update(devices) {
        if (devices.length === 0) {
            this._percentage = -1;
            this._percentLabel.visible = false;
            return false;
        }
        const lowest = devices.reduce((a, b) => (a.percentage <= b.percentage ? a : b));
        this._percentage = Math.round(lowest.percentage);
        this._btIcon.gicon = iconForDeviceType(lowest.deviceType);
        this._percentLabel.text = `${this._percentage}%`;
        this.updatePercentVisibility();
        this._batteryIcon.queue_repaint();
        return true;
    }

    updatePercentVisibility() {
        if (this._percentage < 0)
            return;
        const always = this._settings.get_boolean('always-show-percentage');
        const hover = this._settings.get_boolean('show-hover-percentage');
        const active = !!this._hoverActor?.hover || !!this._hoverMenu?.isOpen;
        this._percentLabel.visible = always || (hover && active);
    }

    destroy() {
        this.setHoverActor(null);
        for (const id of this._settingsIds)
            this._settings.disconnect(id);
        this._settingsIds = [];
    }
}

const QuickSettingsBatteryIndicator = GObject.registerClass(
    class QuickSettingsBatteryIndicator extends QuickSettings.SystemIndicator {
        _init(settings, monitor) {
            super._init();
            this.add_style_class_name('bluetooth-battery-box');

            this._monitor = monitor;
            this._widgets = new PanelBatteryWidgets(this, settings);
            this._widgets.setHoverActor(Main.panel.statusArea.quickSettings);

            this._listener = this._monitor.addListener(devices => {
                this.visible = this._widgets.update(devices);
            });
        }

        destroy() {
            this._monitor.removeListener(this._listener);
            this._widgets.destroy();
            this.quickSettingsItems.forEach(item => item.destroy());
            super.destroy();
        }
    });

const PanelBatteryIndicator = GObject.registerClass(
    class PanelBatteryIndicator extends PanelMenu.Button {
        _init(settings, monitor) {
            super._init(0.0, 'Bluetooth Battery Monitor');
            this.add_style_class_name('bluetooth-battery-panel-button');

            this._settings = settings;
            this._monitor = monitor;

            const box = new St.BoxLayout({
                style_class: 'panel-status-indicators-box bluetooth-battery-box',
            });
            this.add_child(box);
            this._widgets = new PanelBatteryWidgets(box, settings);
            this._widgets.setHoverActor(this);

            this._styleIds = [
                this._settings.connect('changed::hpadding', () => this._updateStyle()),
                this._settings.connect('changed::outer-margin', () => this._updateStyle()),
            ];
            this._updateStyle();

            this._listener = this._monitor.addListener(devices => this._onDevicesChanged(devices));
        }

        _updateStyle() {
            const hpadding = this._settings.get_int('hpadding');
            const outerMargin = Math.max(0, this._settings.get_int('outer-margin'));
            this.style = `-natural-hpadding: ${hpadding}px; -minimum-hpadding: ${Math.max(0, Math.floor(hpadding / 2))}px; margin-left: ${outerMargin}px; margin-right: ${outerMargin}px;`;
        }

        _onDevicesChanged(devices) {
            this.menu.removeAll();
            this.visible = this._widgets.update(devices);

            for (const dev of devices) {
                const pct = Math.round(dev.percentage);
                const item = new PopupMenu.PopupBaseMenuItem();

                const typeIcon = new St.Icon({
                    gicon: iconForDeviceType(dev.deviceType),
                    style_class: 'system-status-icon bluetooth-battery-menu-device-icon',
                    y_align: Clutter.ActorAlign.CENTER,
                });
                typeIcon.set_icon_size(16);
                item.add_child(typeIcon);

                item.add_child(new St.Label({
                    text: dev.model,
                    y_align: Clutter.ActorAlign.CENTER,
                    x_expand: true,
                }));

                const batteryArea = new St.DrawingArea({y_align: Clutter.ActorAlign.CENTER});
                batteryArea.set_size(20, 10);
                batteryArea.connect('repaint', area => repaintBattery(area, pct, drawBatteryHorizontal));
                item.add_child(batteryArea);

                item.add_child(new St.Label({
                    text: `${pct}%`,
                    y_align: Clutter.ActorAlign.CENTER,
                    style_class: 'bluetooth-battery-menu-percent',
                }));

                item.connect('activate', () => {
                    try {
                        Gio.Subprocess.new(['gnome-control-center', 'bluetooth'], Gio.SubprocessFlags.NONE);
                    } catch (e) {
                        console.error(`BluetoothBatteryMonitor: ${e.message}`);
                    }
                });

                this.menu.addMenuItem(item);
            }
        }

        destroy() {
            this._monitor.removeListener(this._listener);
            for (const id of this._styleIds)
                this._settings.disconnect(id);
            this._styleIds = [];
            this._widgets.destroy();
            super.destroy();
        }
    });

class BluetoothMenuDecorator {
    constructor(toggle, monitor) {
        this._toggle = toggle;
        this._monitor = monitor;
        this._decorations = new Map();

        this._openId = toggle.menu.connect('open-state-changed', (_menu, isOpen) => {
            if (isOpen)
                this._monitor.refresh();
        });
        this._client = toggle._client ?? null;
        this._devicesChangedId = this._client?.connect('devices-changed', () => this._sync()) ?? null;
        this._listener = this._monitor.addListener(() => this._sync());
    }

    _batteryFor(device) {
        const mac = String(device.address ?? '').toLowerCase();
        const upowerDev = mac ? this._monitor.devicesByMac().get(mac) : null;
        if (upowerDev)
            return upowerDev.percentage;
        if (device.battery_type === BATTERY_TYPE_PERCENTAGE)
            return device.battery_percentage;
        return null;
    }

    _decorate(item) {
        const subtitle = item._subtitle;
        if (!subtitle || subtitle.get_parent() !== item)
            return null;

        const deco = {percentage: 0};
        deco.box = new St.BoxLayout({
            style_class: 'bluetooth-battery-bt-menu-box',
            y_align: Clutter.ActorAlign.CENTER,
            visible: false,
        });
        deco.area = new St.DrawingArea({
            style_class: 'bluetooth-battery-bt-menu-icon',
            y_align: Clutter.ActorAlign.CENTER,
        });
        deco.area.set_size(20, 10);
        deco.area.connect('repaint', area => repaintBattery(area, deco.percentage, drawBatteryHorizontal));
        deco.label = new St.Label({
            style_class: 'device-subtitle bluetooth-battery-bt-menu-label',
            y_align: Clutter.ActorAlign.CENTER,
        });
        deco.box.add_child(deco.area);
        deco.box.add_child(deco.label);
        item.insert_child_below(deco.box, subtitle);

        deco.destroyId = item.connect('destroy', () => this._decorations.delete(item));
        this._decorations.set(item, deco);
        return deco;
    }

    _sync() {
        const items = this._toggle._deviceItems;
        if (!(items instanceof Map))
            return;

        for (const item of items.values()) {
            const device = item._device;
            if (!device)
                continue;
            const deco = this._decorations.get(item) ?? this._decorate(item);
            if (!deco)
                continue;

            const pct = device.connected ? this._batteryFor(device) : null;
            if (pct === null || pct === undefined || pct < 0) {
                deco.box.visible = false;
                continue;
            }
            deco.percentage = Math.round(pct);
            deco.label.text = `${deco.percentage}%`;
            deco.box.visible = true;
            deco.area.queue_repaint();
        }
    }

    destroy() {
        this._monitor.removeListener(this._listener);
        if (this._openId)
            this._toggle.menu.disconnect(this._openId);
        if (this._client && this._devicesChangedId)
            this._client.disconnect(this._devicesChangedId);
        for (const [item, deco] of this._decorations) {
            item.disconnect(deco.destroyId);
            deco.box.destroy();
        }
        this._decorations.clear();
        this._toggle = null;
        this._client = null;
    }
}

export default class BluetoothBatteryMonitorExtension extends Extension {
    enable() {
        bundledIconsDir = this.dir.get_child('icons');
        this._settings = this.getSettings();
        this._monitor = new BatteryMonitor(this._settings);

        this._settingsIds = [
            this._settings.connect('changed::use-standalone-button', () => {
                this._placeIndicator();
                this._updateOriginalIcon();
            }),
            this._settings.connect('changed::position-box', () => this._placeIndicator()),
            this._settings.connect('changed::position-index', () => this._placeIndicator()),
            this._settings.connect('changed::hide-original-bluetooth-icon', () => this._updateOriginalIcon()),
        ];

        this._whenQuickSettingsReady(() => {
            this._placeIndicator();
            this._updateOriginalIcon();
            this._updateMenuDecorator();
        });
    }

    _whenQuickSettingsReady(callback) {
        const isReady = () => !!Main.panel.statusArea.quickSettings?._system?.get_parent();
        if (isReady()) {
            callback();
            return;
        }
        let tries = 0;
        this._readySourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
            if (isReady() || ++tries >= 50) {
                this._readySourceId = null;
                callback();
                return GLib.SOURCE_REMOVE;
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    _placeIndicator() {
        this._indicator?.destroy();
        this._indicator = null;

        const quickSettings = Main.panel.statusArea.quickSettings;
        const standalone = this._settings.get_boolean('use-standalone-button');

        if (!standalone && quickSettings?.addExternalIndicator) {
            this._indicator = new QuickSettingsBatteryIndicator(this._settings, this._monitor);
            quickSettings.addExternalIndicator(this._indicator);
            this._indicator.connect('notify::visible', () => this._updateOriginalIcon());

            const container = this._indicator.get_parent();
            const bluetooth = quickSettings._bluetooth;
            if (container && bluetooth?.get_parent() === container)
                container.set_child_above_sibling(this._indicator, bluetooth);
            return;
        }

        this._indicator = new PanelBatteryIndicator(this._settings, this._monitor);
        const box = this._settings.get_string('position-box');
        const panelBox = ['left', 'center', 'right'].includes(box) ? box : 'right';
        let index = this._settings.get_int('position-index');
        if (index === -1) {
            index = 0;
            if (panelBox === 'right' && quickSettings) {
                const qsIndex = Main.panel._rightBox.get_children().indexOf(quickSettings.container);
                if (qsIndex >= 0)
                    index = qsIndex;
            }
        }
        Main.panel.addToStatusArea(this.uuid, this._indicator, index, panelBox);
    }

    _shouldHideOriginalIcon() {
        if (this._settings.get_boolean('use-standalone-button'))
            return this._settings.get_boolean('hide-original-bluetooth-icon');
        return !!this._indicator?.visible;
    }

    _updateOriginalIcon() {
        const bluetooth = Main.panel.statusArea.quickSettings?._bluetooth;
        const icon = bluetooth?._indicator;
        if (!icon)
            return;

        const hide = this._shouldHideOriginalIcon();
        if (hide && !this._originalIconSignalId) {
            this._originalIcon = icon;
            this._originalIconSignalId = icon.connect('notify::visible', () => {
                if (icon.visible && this._shouldHideOriginalIcon())
                    icon.visible = false;
            });
            icon.visible = false;
        } else if (!hide) {
            this._restoreOriginalIcon();
        }
    }

    _restoreOriginalIcon() {
        if (!this._originalIcon)
            return;
        this._originalIcon.disconnect(this._originalIconSignalId);
        this._originalIconSignalId = null;
        const bluetooth = Main.panel.statusArea.quickSettings?._bluetooth;
        if (bluetooth?._sync)
            bluetooth._sync();
        else
            this._originalIcon.visible = true;
        this._originalIcon = null;
    }

    _updateMenuDecorator() {
        this._menuDecorator?.destroy();
        this._menuDecorator = null;

        const toggle = Main.panel.statusArea.quickSettings?._bluetooth?.quickSettingsItems?.[0];
        if (toggle?.menu && toggle._deviceItems instanceof Map)
            this._menuDecorator = new BluetoothMenuDecorator(toggle, this._monitor);
    }

    disable() {
        if (this._readySourceId) {
            GLib.source_remove(this._readySourceId);
            this._readySourceId = null;
        }
        for (const id of this._settingsIds ?? [])
            this._settings.disconnect(id);
        this._settingsIds = null;

        this._menuDecorator?.destroy();
        this._menuDecorator = null;
        this._indicator?.destroy();
        this._indicator = null;
        this._restoreOriginalIcon();
        this._monitor?.destroy();
        this._monitor = null;
        this._settings = null;
        bundledIconsDir = null;
    }
}
