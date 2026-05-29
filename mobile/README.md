# Android Support via gomobile bind

This feature enables the OpenRadar core (photon packet parser) to be used as an Android library via [gomobile bind](https://pkg.go.dev/golang.org/x/mobile/cmd/gomobile).

## Architecture

```
mobile/
├── photonbind/           # Go package for gomobile bind
│   ├── go.mod
│   ├── photon.go         # Core parser adapted for mobile
│   └── (photonbind.aar)  # Built artifact (after `make build-android`)
└── android/
    └── java/com/albionradar/
        ├── AlbionRadar.java  # Java wrapper with JNI callbacks
        └── build.gradle      # Android library module

cmd/radar/        # Existing desktop app (unchanged)
internal/
├── capture/      # Network packet capture (pcap/GOPacket)
├── photon/       # Photon protocol parser (desktop)
└── server/       # HTTP/WebSocket server
```

## How It Works

1. **Go Core** (`mobile/photonbind/photon.go`): A minimal wrapper around the photon packet parsing logic, exposed as a clean API without CGO dependencies.

2. **gomobile bind**: Converts the Go package into an Android `.aar` (Android Archive) containing both the Java bindings and the native `.so` libraries for all supported ABIs.

3. **Java Wrapper** (`AlbionRadar.java`): Provides a callback-based API for Android apps to receive game events.

## Building

### Prerequisites

- Go 1.21+
- Android NDK
- Android SDK (API 24+)

### Build Command

```bash
make build-android
```

Or manually:

```bash
cd mobile/photonbind
go install golang.org/x/mobile/cmd/gomobile@latest
go install golang.org/x/mobile/cmd/gobind@latest
gomobile init
gomobile bind -target=android -androidapi=24 -o photonbind.aar ./
```

### Output

The build produces `mobile/photonbind/photonbind.aar`.

## Usage in Android App

```gradle
// settings.gradle or app/build.gradle
implementation(files('libs/photonbind.aar'))
```

```java
import com.albionradar.AlbionRadar;

// In your Activity or Service
AlbionRadar radar = new AlbionRadar();
radar.initialize();

radar.setEventCallback((eventCode, paramsJson) -> {
    // Handle player enter/leave/move events
    Log.d("AlbionRadar", "Event " + eventCode + ": " + paramsJson);
});

radar.start();
// ... radar is now processing packets
radar.stop();
radar.release();
```

## Feature Scope

The mobile binding exposes:
- `PhotonParser` - Core packet deserialization (events, requests, responses)
- `PlayerInfo` - Player data structure with name, IP, health, position
- `EventData` - Deserialized event with code and parameters map

**Note:** Network packet capture (`capture/pcap.go`) cannot run on Android due to lack of raw socket access. On mobile, the parser expects pre-received UDP payloads from a companion app or network proxy running on the same device. The desktop radar (`cmd/radar`) continues to handle the actual packet capture on Windows/Linux/macOS.

## Adding to Your Android Project

1. Copy `photonbind.aar` to `your-android-project/app/libs/`
2. Add to `app/build.gradle`:
   ```gradle
   dependencies {
       implementation(files('libs/photonbind.aar'))
   }
   ```
3. Add network permission to `AndroidManifest.xml`:
   ```xml
   <uses-permission android:name="android.permission.INTERNET" />
   ```
4. Initialize the library at app startup

## Porting Notes

The binding strips desktop-only code:
- No `pcap` (network capture) - handled externally
- No TUI (`bubbletea`) - handled by Android UI
- No `embed.FS` (static assets) - served from Android assets

The photon parser itself is compatible - it uses the same `segmentio/encoding/json` for parameter deserialization as the desktop version.