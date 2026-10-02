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

        const advancedSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: settings.get_boolean('show-advanced-settings'),
        });
        const advancedRow = new Adw.ActionRow({
            title: 'Advanced Settings',
            subtitle: 'Enable custom layout parameters (padding and spacing)',
            activatable_widget: advancedSwitch,
        });
        advancedRow.add_suffix(advancedSwitch);
        group.add(advancedRow);

        const positioningGroup = new Adw.PreferencesGroup({
            title: 'Positioning',
        });
        page.add(positioningGroup);

        const BOX_OPTIONS = [
            ['left', 'Panel: Left Box'],
            ['center', 'Panel: Center Box'],
            ['right', 'Panel: Right Box'],
        ];
        const boxModel = Gtk.StringList.new(BOX_OPTIONS.map(([, label]) => label));
        const currentBox = settings.get_string('position-box') || 'right';
        const selectedBoxIdx = BOX_OPTIONS.findIndex(([val]) => val === currentBox);

        const containerTargetRow = new Adw.ComboRow({
            title: 'Container Target',
            subtitle: 'Select which area of the top panel to place the widget in',
            model: boxModel,
            selected: selectedBoxIdx >= 0 ? selectedBoxIdx : 2,
        });
        containerTargetRow.connect('notify::selected', (row) => {
            const idx = row.selected;
            const val = BOX_OPTIONS[idx]?.[0] ?? 'right';
            if (settings.get_string('position-box') !== val) {
                settings.set_string('position-box', val);
            }
        });
        positioningGroup.add(containerTargetRow);

        const updateBoxSelection = () => {
            const val = settings.get_string('position-box') || 'right';
            const idx = BOX_OPTIONS.findIndex(([o]) => o === val);
            if (idx >= 0 && containerTargetRow.selected !== idx) {
                containerTargetRow.selected = idx;
            }
        };
        settings.connect('changed::position-box', updateBoxSelection);

        const positionIndexSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: -1,
                upper: 20,
                step_increment: 1,
                page_increment: 5,
                value: settings.get_int('position-index'),
            }),
            valign: Gtk.Align.CENTER,
        });
        settings.bind(
            'position-index',
            positionIndexSpinButton,
            'value',
            Gio.SettingsBindFlags.DEFAULT,
        );

        const positionIndexRow = new Adw.ActionRow({
            title: 'Position Index',
            subtitle: 'Order within the box (-1 for Auto, 0 is leftmost)',
            activatable_widget: positionIndexSpinButton,
        });
        positionIndexRow.add_suffix(positionIndexSpinButton);
        positioningGroup.add(positionIndexRow);

        const advancedGroup = new Adw.PreferencesGroup({
            title: 'Advanced Layout Settings',
            visible: settings.get_boolean('show-advanced-settings'),
        });
        page.add(advancedGroup);

        const hpaddingSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 20,
                step_increment: 1,
                page_increment: 5,
                value: settings.get_int('hpadding'),
            }),
            valign: Gtk.Align.CENTER,
        });
        settings.bind(
            'hpadding',
            hpaddingSpinButton,
            'value',
            Gio.SettingsBindFlags.DEFAULT,
        );
        const hpaddingRow = new Adw.ActionRow({
            title: 'Inner Horizontal Padding',
            subtitle: 'Padding inside the widget capsule (default: 6)',
            activatable_widget: hpaddingSpinButton,
        });
        hpaddingRow.add_suffix(hpaddingSpinButton);
        advancedGroup.add(hpaddingRow);

        const outerMarginSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 20,
                step_increment: 1,
                page_increment: 5,
                value: settings.get_int('outer-margin'),
            }),
            valign: Gtk.Align.CENTER,
        });
        settings.bind(
            'outer-margin',
            outerMarginSpinButton,
            'value',
            Gio.SettingsBindFlags.DEFAULT,
        );
        const outerMarginRow = new Adw.ActionRow({
            title: 'Outer Margin (Widget Spacing)',
            subtitle: 'Extra space around the widget (0 = default, higher = more space)',
            activatable_widget: outerMarginSpinButton,
        });
        outerMarginRow.add_suffix(outerMarginSpinButton);
        advancedGroup.add(outerMarginRow);

        let isInternalChange = false;
        advancedSwitch.connect('notify::active', () => {
            if (isInternalChange) return;
            const active = advancedSwitch.active;
            if (active) {
                isInternalChange = true;
                advancedSwitch.active = false;
                isInternalChange = false;

                const dialog = new Adw.MessageDialog({
                    transient_for: window,
                    heading: 'Enable Advanced Settings?',
                    body: 'Warning: Changing these layout properties can cause UI rendering issues or crash the GNOME Shell top panel. Please configure them with caution.',
                });

                dialog.add_response('cancel', 'Cancel');
                dialog.add_response('enable', 'Enable');
                dialog.set_response_appearance('enable', Adw.ResponseAppearance.DESTRUCTIVE);

                dialog.connect('response', (dlg, responseId) => {
                    if (responseId === 'enable') {
                        settings.set_boolean('show-advanced-settings', true);
                    }
                    dlg.destroy();
                });

                dialog.present();
            } else {
                settings.set_boolean('show-advanced-settings', false);
            }
        });

        const updateAdvancedGroupVisibility = () => {
            const visible = settings.get_boolean('show-advanced-settings');
            if (advancedGroup.visible !== visible) {
                advancedGroup.visible = visible;
            }
            if (advancedSwitch.active !== visible) {
                isInternalChange = true;
                advancedSwitch.active = visible;
                isInternalChange = false;
            }
        };
        settings.connect('changed::show-advanced-settings', updateAdvancedGroupVisibility);

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
            settings.reset('position-box');
            settings.reset('position-index');
            settings.reset('show-advanced-settings');
            settings.reset('hpadding');
            settings.reset('outer-margin');
            buildDeviceList();
        });
        resetRow.add_suffix(resetButton);
        resetGroup.add(resetRow);

        window.add(page);
    }
}
