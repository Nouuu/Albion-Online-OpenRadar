//go:build dev

package assets

import "embed"

// Stub assets for development mode (faster builds)
// In dev mode, files are read from disk, not embedded

var Images embed.FS
var Scripts embed.FS
var Data embed.FS
var Sounds embed.FS
var Styles embed.FS
var Templates embed.FS
