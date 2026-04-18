// Package eventcodes is the Go mirror of web/scripts/utils/EventCodes.js.
//
// The JS file is the committed single source of truth for Albion event codes.
// Run `go generate ./internal/photon/eventcodes/...` after editing the JS file
// to regenerate eventcodes.go.
package eventcodes

//go:generate go run ../../../tools/gen-eventcodes
