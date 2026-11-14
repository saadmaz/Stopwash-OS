#!/bin/sh
# Start the emulators, importing saved data when an export exists.
set -e
DATA=/firebase/emulator-data
if [ -f "$DATA/firebase-export-metadata.json" ]; then
  exec firebase emulators:start --project demo-stopwash --import "$DATA" --export-on-exit "$DATA"
fi
exec firebase emulators:start --project demo-stopwash --export-on-exit "$DATA"
