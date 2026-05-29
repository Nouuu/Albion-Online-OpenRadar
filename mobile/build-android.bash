#!/bin/bash
# Build script for gomobile bind
# Run: make build-android

set -e

GOMOBILE=/opt/data/gomobile
export GOPATH=/opt/data/gopath
export PATH=$GOPATH/bin:$GOMOBILE/bin:$PATH

# Initialize gomobile if not already done
if [ ! -d "$GOMOBILE/pkg" ]; then
    echo "[BUILD] Initializing gomobile..."
    mkdir -p "$GOPATH"
    cd mobile/photonbind
    go mod download
    go install golang.org/x/mobile/cmd/gomobile@latest
    go install golang.org/x/mobile/cmd/gobind@latest
    gomobile init -ndk /opt/android-ndk 2>/dev/null || echo "[BUILD] gomobile init skipped (may need NDK)"
fi

# Build for Android
echo "[BUILD] Building Android binding..."
cd mobile/photonbind
gomobile bind -target=android -androidapi=24 -o photonbind.aar ./