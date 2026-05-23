#!/bin/sh
set -e

# Capture runtime UID/GID from environment variables, defaulting to 1000
PUID=${USER_UID:-1000}
PGID=${USER_GID:-1000}

# Adjust the node user's UID/GID if they differ from the runtime request
# and fix volume ownership only when a remap is needed
changed=0

if [ "$(id -u node)" -ne "$PUID" ]; then
    echo "Updating node UID to $PUID"
    usermod -o -u "$PUID" node
    changed=1
fi

if [ "$(id -g node)" -ne "$PGID" ]; then
    echo "Updating node GID to $PGID"
    groupmod -o -g "$PGID" node
    usermod -g "$PGID" node
    changed=1
fi

if [ "$changed" = "1" ]; then
    chown -R node:node /paperclip
fi

# Sync bundled plugins (baked into image) into the data volume on every start.
# This ensures custom plugins are always up to date with the image version.
if [ -d /bundled-plugins ]; then
    for plugin_dir in /bundled-plugins/*/; do
        plugin_name=$(basename "$plugin_dir")
        target_dir="/paperclip/plugins/$plugin_name"
        echo "Syncing bundled plugin: $plugin_name"
        mkdir -p "$target_dir"
        cp -r "$plugin_dir/." "$target_dir/"
        chown -R node:node "$target_dir" 2>/dev/null || true
    done
fi

exec gosu node "$@"
