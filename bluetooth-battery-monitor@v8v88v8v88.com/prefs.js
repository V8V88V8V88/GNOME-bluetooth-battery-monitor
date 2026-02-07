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

        window.add(page);
    }
}
