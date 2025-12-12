//go:build !dev

package assets

import "embed"

// Embedded static assets for the web server (production build)
// These are compiled into the binary for single-file distribution

//go:embed all:web/images
var Images embed.FS

//go:embed all:web/scripts
var Scripts embed.FS

//go:embed all:web/public
var Public embed.FS

//go:embed all:web/sounds
var Sounds embed.FS
