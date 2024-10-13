"use strict";

const { Adw, Gio, Gtk } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

function init() {}

function fillPreferencesWindow(window) {
  const settings = ExtensionUtils.getSettings(
    "org.gnome.shell.extensions.bluetooth-battery-monitor",
  );

  // Create a preferences page and group
  const page = new Adw.PreferencesPage();
  const group = new Adw.PreferencesGroup();
  page.add(group);

  // Show battery percentage
  const showBatterySwitch = new Gtk.Switch({
    active: settings.get_boolean("show-battery-percentage"),
    valign: Gtk.Align.CENTER,
  });
  settings.bind(
    "show-battery-percentage",
    showBatterySwitch,
    "active",
    Gio.SettingsBindFlags.DEFAULT,
  );
  const showBatteryRow = new Adw.ActionRow({
    title: "Show Battery Percentage",
    activatable_widget: showBatterySwitch,
  });
  showBatteryRow.add_suffix(showBatterySwitch);
  group.add(showBatteryRow);

  // Update interval
  const updateIntervalSpinButton = new Gtk.SpinButton({
    adjustment: new Gtk.Adjustment({
      lower: 1,
      upper: 60,
      step_increment: 1,
      page_increment: 10,
      value: settings.get_int("update-interval"),
    }),
    valign: Gtk.Align.CENTER,
  });
  settings.bind(
    "update-interval",
    updateIntervalSpinButton,
    "value",
    Gio.SettingsBindFlags.DEFAULT,
  );
  const updateIntervalRow = new Adw.ActionRow({
    title: "Update Interval (minutes)",
    activatable_widget: updateIntervalSpinButton,
  });
  updateIntervalRow.add_suffix(updateIntervalSpinButton);
  group.add(updateIntervalRow);

  // Add our page to the window
  window.add(page);
}
