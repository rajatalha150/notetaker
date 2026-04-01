#!/bin/bash
# Post-installation script for Notetaker .deb package

# Update desktop database so the app appears in launchers
if command -v update-desktop-database > /dev/null 2>&1; then
  update-desktop-database -q /usr/share/applications || true
fi

# Update icon cache
if command -v gtk-update-icon-cache > /dev/null 2>&1; then
  gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
fi

# Set chrome-sandbox permissions (required for Electron on some systems)
SANDBOX="/opt/Notetaker/chrome-sandbox"
if [ -f "$SANDBOX" ]; then
  chown root:root "$SANDBOX"
  chmod 4755 "$SANDBOX"
fi

echo "Notetaker installed successfully."
