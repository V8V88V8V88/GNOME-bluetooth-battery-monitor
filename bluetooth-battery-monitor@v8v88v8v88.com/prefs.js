import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

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

        window.add(page);
    }
}
