package assets

import "embed"

// Embedded static assets for the web server
// These are compiled into the binary for single-file distribution

//go:embed all:images
var Images embed.FS

//go:embed all:scripts
var Scripts embed.FS

//go:embed all:public
var Public embed.FS

//go:embed all:sounds
var Sounds embed.FS
