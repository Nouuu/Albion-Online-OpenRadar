// Package operationcodes is the Go mirror of web/scripts/utils/OperationCodes.js.
//
// The JS file is the committed single source of truth for Albion operation
// codes (request and response opcodes carried in Parameters[253]). Run
// `go generate ./internal/photon/operationcodes/...` after editing the JS
// file to regenerate operationcodes.go.
package operationcodes

//go:generate go run ../../../tools/gen-eventcodes
