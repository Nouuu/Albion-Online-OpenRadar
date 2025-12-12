//go:build dev

package assets

import "embed"

// Stub assets for development mode (faster builds)
// In dev mode, files are read from disk, not embedded

var Images embed.FS
var Scripts embed.FS
var Public embed.FS
var Sounds embed.FS
