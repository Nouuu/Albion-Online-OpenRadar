// Package operationcodes is the Go mirror of web/scripts/utils/OperationCodes.js.
//
// The JS file is the committed single source of truth for Albion operation
// codes (request and response opcodes carried in Parameters[253]). The
// generator that produces operationcodes.go lives at tools/gen-eventcodes and
// is driven by the go:generate directive in internal/photon/eventcodes/doc.go
// (one invocation rebuilds both mirrors). Run `make gen-codes` or
// `go generate ./internal/photon/eventcodes/...` after editing the JS file.
package operationcodes
