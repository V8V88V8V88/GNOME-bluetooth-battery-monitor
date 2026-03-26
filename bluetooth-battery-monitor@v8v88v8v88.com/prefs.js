import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const COMBO_OPTIONS = [
    ['', 'Auto'],
    ['headphone', 'Headphone'],
    ['speaker', 'Speaker'],
    ['controller', 'Controller'],
    ['mouse', 'Mouse'],
    ['keyboard', 'Keyboard'],
    ['phone', 'Phone'],
    ['tv', 'TV'],
    ['tablet', 'Tablet'],
    ['watch', 'Watch'],
    ['car', 'Car'],
];

export default class BluetoothBatteryMonitorPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup();
        page.add(group);

        const updateIntervalSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 60,
                step_increment: 1,
                page_increment: 10,
                value: settings.get_int('update-interval'),
            }),
            valign: Gtk.Align.CENTER,
        });
        settings.bind(
            'update-interval',
            updateIntervalSpinButton,
            'value',
            Gio.SettingsBindFlags.DEFAULT,
        );
        const updateIntervalRow = new Adw.ActionRow({
            title: 'Update Interval (minutes)',
            activatable_widget: updateIntervalSpinButton,
        });
        updateIntervalRow.add_suffix(updateIntervalSpinButton);
        group.add(updateIntervalRow);

        const alwaysShowSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        settings.bind(
            'always-show-percentage',
            alwaysShowSwitch,
            'active',
            Gio.SettingsBindFlags.DEFAULT,
        );
        const alwaysShowRow = new Adw.ActionRow({
            title: 'Always show percentage',
            subtitle: 'Keep the battery percentage always visible in the panel',
            activatable_widget: alwaysShowSwitch,
        });
        alwaysShowRow.add_suffix(alwaysShowSwitch);
        group.add(alwaysShowRow);

        const showHoverSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        settings.bind(
            'show-hover-percentage',
            showHoverSwitch,
            'active',
            Gio.SettingsBindFlags.DEFAULT,
        );
        const showHoverRow = new Adw.ActionRow({
            title: 'Show percentage on hover',
            subtitle: 'When "Always show" is off: show percentage on hover. Disable to prevent layout shifts.',
            activatable_widget: showHoverSwitch,
        });
        showHoverRow.add_suffix(showHoverSwitch);
        group.add(showHoverRow);

        const updateHoverSensitivity = () => {
            showHoverRow.sensitive = !settings.get_boolean('always-show-percentage');
        };
        updateHoverSensitivity();
        settings.connect('changed::always-show-percentage', updateHoverSensitivity);

        const hideOriginalSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        settings.bind(
            'hide-original-bluetooth-icon',
            hideOriginalSwitch,
            'active',
            Gio.SettingsBindFlags.DEFAULT,
        );
        const hideOriginalRow = new Adw.ActionRow({
            title: 'Hide original Bluetooth icon',
            subtitle: 'Hide the built-in Bluetooth status icon and only show this extension',
            activatable_widget: hideOriginalSwitch,
        });
        hideOriginalRow.add_suffix(hideOriginalSwitch);
        group.add(hideOriginalRow);

        const overrideGroup = new Adw.PreferencesGroup({
            title: 'Device icons',
            description: 'Choose icon type for each device. Set to Auto for automatic detection.',
        });
        page.add(overrideGroup);

        const model = Gtk.StringList.new(COMBO_OPTIONS.map(([, label]) => label));
        let devices = [];

        function getOverrideFor(modelName) {
            const overrides = settings.get_strv('device-overrides');
            for (const entry of overrides) {
                const i = entry.lastIndexOf('|');
                if (i <= 0) continue;
                if (entry.slice(0, i).toLowerCase().trim() === modelName.toLowerCase().trim())
                    return entry.slice(i + 1);
            }
            return '';
        }

        function setOverride(modelName, type) {
            const overrides = settings.get_strv('device-overrides');
            const filtered = overrides.filter(e => {
                const i = e.lastIndexOf('|');
                return i > 0 && e.slice(0, i).toLowerCase().trim() !== modelName.toLowerCase().trim();
            });
            if (type)
                filtered.push(`${modelName.trim()}|${type}`);
            settings.set_strv('device-overrides', filtered);
        }

        function buildDeviceList() {
            let child = overrideGroup.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                overrideGroup.remove(child);
                child = next;
            }
            devices = [];
            try {
                const bus = Gio.bus_get_sync(Gio.BusType.SYSTEM, null);
                const paths = bus.call_sync('org.freedesktop.UPower', '/org/freedesktop/UPower', 'org.freedesktop.UPower', 'EnumerateDevices', null, null, Gio.DBusCallFlags.NONE, -1, null).deep_unpack()[0];
                for (const path of paths) {
                    if (path.includes('battery_BAT') || path.includes('line_power'))
                        continue;
                    try {
                        const proxy = Gio.DBusProxy.new_sync(bus, Gio.DBusProxyFlags.NONE, null, 'org.freedesktop.UPower', path, 'org.freedesktop.DBus.Properties', null);
                        const result = proxy.call_sync('GetAll', new GLib.Variant('(s)', ['org.freedesktop.UPower.Device']), Gio.DBusCallFlags.NONE, -1, null);
                        const props = result.deep_unpack()[0];
                        const modelVal = props['Model'];
                        const name = (modelVal?.deep_unpack ? modelVal.deep_unpack() : modelVal) || 'Unknown';
                        const presentVal = props['IsPresent'];
                        const present = presentVal?.deep_unpack ? presentVal.deep_unpack() : presentVal;
                        if (!present) continue;
                        const currentOverride = getOverrideFor(name);
                        const selectedIdx = COMBO_OPTIONS.findIndex(([t]) => t === currentOverride);
                        const comboRow = new Adw.ComboRow({
                            title: String(name),
                            model,
                            selected: selectedIdx >= 0 ? selectedIdx : 0,
                        });
                        comboRow.connect('notify::selected', (row) => {
                            const idx = row.selected;
                            const type = COMBO_OPTIONS[idx]?.[0] ?? '';
                            setOverride(name, type);
                        });
                        overrideGroup.add(comboRow);
                        devices.push({ name, comboRow });
                    } catch (_e) { }
                }
            } catch (_e) { }
            if (devices.length === 0) {
                const emptyRow = new Adw.ActionRow({
                    title: 'No devices connected',
                    subtitle: 'Connect a Bluetooth device with battery to configure its icon.',
                });
                overrideGroup.add(emptyRow);
            }
        }

        buildDeviceList();

        const resetGroup = new Adw.PreferencesGroup({
            title: 'Danger zone',
        });
        page.add(resetGroup);

        const resetRow = new Adw.ActionRow({
            title: 'Reset all settings',
            subtitle: 'Restore default behavior and clear device icon overrides.',
        });
        const resetButton = new Gtk.Button({
            label: 'Reset',
            valign: Gtk.Align.CENTER,
        });
        resetButton.add_css_class('destructive-action');
        resetButton.connect('clicked', () => {
            settings.reset('update-interval');
            settings.reset('show-hover-percentage');
            settings.reset('always-show-percentage');
            settings.reset('hide-original-bluetooth-icon');
            settings.reset('device-overrides');
            buildDeviceList();
        });
        resetRow.add_suffix(resetButton);
        resetGroup.add(resetRow);

        window.add(page);
    }
}
