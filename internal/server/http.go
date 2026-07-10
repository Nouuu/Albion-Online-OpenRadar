package server

import (
	"bytes"
	"compress/gzip"
	"context"
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/nospy/albion-openradar/internal/capture"
	"github.com/nospy/albion-openradar/internal/logger"
	"github.com/nospy/albion-openradar/internal/templates"
)

// HTTPServer serves static files and WebSocket from embedded assets or filesystem
type HTTPServer struct {
	port      int
	mux       *http.ServeMux
	server    *http.Server
	logger    *logger.Logger
	wsHandler *WebSocketHandler
	// Filesystems (can be embed.FS or os.DirFS)
	images  fs.FS
	scripts fs.FS
	data    fs.FS
	sounds  fs.FS
	styles  fs.FS
	// Template engine
	tmpl        *templates.Engine
	version     string
	assetID     string
	devMode     bool
	networkAPI  *NetworkAPI
	settingsAPI *SettingsAPI
}

// buildID fingerprints the embedded assets. It is empty for an unversioned build,
// whose Version stays "dev" and would collide with the next one. BuildTime is folded
// in because two builds of the same git tag can embed different assets.
func buildID(version, buildTime string) string {
	if version == "" || version == "dev" {
		return ""
	}
	return etagSafe(version + "-" + buildTime)
}

// etagSafe keeps only the bytes RFC 9110 allows inside an opaque-tag.
func etagSafe(s string) string {
	return strings.Map(func(r rune) rune {
		if r > 0x20 && r < 0x7f && r != '"' {
			return r
		}
		return '-'
	}, s)
}

// NewHTTPServer creates a new HTTP server with embedded assets (production mode)
func NewHTTPServer(
	port int,
	images, scripts, data, sounds, styles, tmplFS embed.FS,
	wsHandler *WebSocketHandler,
	log *logger.Logger,
	version string,
	buildTime string,
	mgr NetworkManager,
	allInterfaces []capture.NetworkInterface,
	appDir string,
	recorder Recorder,
	captureDir string,
) (*HTTPServer, error) {
	// Extract subdirectories from embed.FS (they include the folder path)
	imagesFS, err := fs.Sub(images, "web/images")
	if err != nil {
		fmt.Printf("[HTTP] Warning: failed to load images: %v\n", err)
	}
	scriptsFS, err := fs.Sub(scripts, "web/scripts")
	if err != nil {
		fmt.Printf("[HTTP] Warning: failed to load scripts: %v\n", err)
	}
	dataFS, err := fs.Sub(data, "web/ao-bin-dumps")
	if err != nil {
		fmt.Printf("[HTTP] Warning: failed to load data: %v\n", err)
	}
	soundsFS, err := fs.Sub(sounds, "web/sounds")
	if err != nil {
		fmt.Printf("[HTTP] Warning: failed to load sounds: %v\n", err)
	}
	stylesFS, err := fs.Sub(styles, "web/styles")
	if err != nil {
		fmt.Printf("[HTTP] Warning: failed to load styles: %v\n", err)
	}

	// Initialize template engine (required)
	tmpl, err := templates.NewEngine(tmplFS, "internal/templates")
	if err != nil {
		return nil, fmt.Errorf("failed to load templates: %w", err)
	}
	fmt.Println("[HTTP] Template engine initialized (SSR mode)")

	s := &HTTPServer{
		port:      port,
		mux:       http.NewServeMux(),
		logger:    log,
		wsHandler: wsHandler,
		images:    imagesFS,
		scripts:   scriptsFS,
		data:      dataFS,
		sounds:    soundsFS,
		styles:    stylesFS,
		tmpl:      tmpl,
		version:   version,
		assetID:   buildID(version, buildTime),
	}
	if mgr != nil {
		s.networkAPI = NewNetworkAPI(mgr, allInterfaces, appDir, capture.LANAddresses)
	}
	s.settingsAPI = NewSettingsAPI(appDir, log, recorder, captureDir)
	s.setupRoutes()
	return s, nil
}

// NewHTTPServerDev creates a new HTTP server reading from filesystem (dev mode)
func NewHTTPServerDev(
	port int,
	appDir string,
	wsHandler *WebSocketHandler,
	log *logger.Logger,
	version string,
	buildTime string,
	mgr NetworkManager,
	allInterfaces []capture.NetworkInterface,
	recorder Recorder,
	captureDir string,
) (*HTTPServer, error) {
	// Initialize template engine in dev mode (hot reload)
	tmplDir := appDir + "/internal/templates"
	tmpl, err := templates.NewEngineDev(tmplDir)
	if err != nil {
		return nil, fmt.Errorf("failed to load templates: %w", err)
	}
	fmt.Println("[HTTP] Template engine initialized (dev mode with hot reload)")

	s := &HTTPServer{
		port:      port,
		mux:       http.NewServeMux(),
		logger:    log,
		wsHandler: wsHandler,
		images:    os.DirFS(appDir + "/web/images"),
		scripts:   os.DirFS(appDir + "/web/scripts"),
		data:      os.DirFS(appDir + "/web/ao-bin-dumps"),
		sounds:    os.DirFS(appDir + "/web/sounds"),
		styles:    os.DirFS(appDir + "/web/styles"),
		tmpl:      tmpl,
		version:   version,
		assetID:   buildID(version, buildTime),
		devMode:   true,
	}
	if mgr != nil {
		s.networkAPI = NewNetworkAPI(mgr, allInterfaces, appDir, capture.LANAddresses)
	}
	s.settingsAPI = NewSettingsAPI(appDir, log, recorder, captureDir)
	s.setupRoutes()
	return s, nil
}

// setupRoutes configures all HTTP routes
func (s *HTTPServer) setupRoutes() {
	// WebSocket endpoint
	if s.wsHandler != nil {
		s.mux.Handle("/ws", s.wsHandler)
	}

	// Page routes - SSR with Go templates
	pageRoutes := map[string]string{
		"/":           "radar",
		"/home":       "radar",
		"/players":    "players",
		"/resources":  "resources",
		"/enemies":    "enemies",
		"/chests":     "chests",
		"/ignorelist": "ignorelist",
		"/settings":   "settings",
	}

	for route, page := range pageRoutes {
		pageName := page // Capture for closure
		s.mux.HandleFunc(route, func(w http.ResponseWriter, r *http.Request) {
			s.renderPage(w, r, pageName)
		})
	}

	// Items and Spells: serve fallback image if not found
	s.mux.Handle("/images/Items/", s.fsHandlerWithFallback("/images/Items/", s.images, "Items", "_default.webp"))
	s.mux.Handle("/images/Spells/", s.fsHandlerWithFallback("/images/Spells/", s.images, "Spells", "_default.webp"))
	s.mux.Handle("/images/", s.fsHandler("/images/", s.images))
	s.mux.Handle("/scripts/", s.gzipFSHandlerDirect("/scripts/", s.scripts))
	s.mux.Handle("/sounds/", s.fsHandler("/sounds/", s.sounds))
	s.mux.Handle("/styles/", s.gzipFSHandlerDirect("/styles/", s.styles))

	// ao-bin-dumps with gzip support (data FS is already the ao-bin-dumps directory)
	s.mux.Handle("/ao-bin-dumps/", s.gzipFSHandlerDirect("/ao-bin-dumps/", s.data))

	// API endpoints
	apiMux := http.NewServeMux()
	s.settingsAPI.Register(apiMux)
	if s.networkAPI != nil {
		s.networkAPI.Register(apiMux)
	}
	s.mux.Handle("/api/", noStore(apiMux))
}

func noStore(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		h.ServeHTTP(w, r)
	})
}

// renderPage renders a page template
func (s *HTTPServer) renderPage(w http.ResponseWriter, r *http.Request, page string) {
	// Get page title
	titles := map[string]string{
		"radar":      "Radar",
		"players":    "Players",
		"resources":  "Resources",
		"enemies":    "Enemies",
		"chests":     "Chests",
		"ignorelist": "Ignore List",
		"settings":   "Settings",
	}
	title := titles[page]
	if title == "" && page != "" {
		// Capitalize first letter
		title = strings.ToUpper(page[:1]) + page[1:]
	}

	data := templates.NewPageData(page, "OpenRadar - "+title).WithVersion(s.version)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Vary", "Hx-Request")

	// Check if this is an HTMX request (SPA navigation)
	isHTMX := r.Header.Get("Hx-Request") == "true"

	var err error
	if isHTMX {
		// HTMX request: return only the page content (partial render)
		err = s.tmpl.RenderPartial(w, page, data)
	} else {
		// Normal request: return full page with layout
		err = s.tmpl.RenderPage(w, page, data)
	}

	if err != nil {
		s.logger.Error("http", "render", fmt.Sprintf("Failed to render page %s: %v", page, err), nil)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
}

// assetETag returns "" when the build carries no trustworthy fingerprint.
// An ETag identifies a representation, so the gzip variant needs its own.
func (s *HTTPServer) assetETag(gzipped bool) string {
	if s.devMode || s.assetID == "" {
		return ""
	}
	if gzipped {
		return `"` + s.assetID + `-gz"`
	}
	return `"` + s.assetID + `"`
}

func (s *HTTPServer) setStaticCacheHeaders(w http.ResponseWriter, vary string, gzipped bool) {
	w.Header().Set("Cache-Control", "no-cache")
	if etag := s.assetETag(gzipped); etag != "" {
		w.Header().Set("Etag", etag)
	}
	if vary != "" {
		w.Header().Set("Vary", vary)
	}
}

// fsHandler creates a file server handler from fs.FS
func (s *HTTPServer) fsHandler(prefix string, fsys fs.FS) http.Handler {
	handler := http.StripPrefix(prefix, http.FileServer(http.FS(fsys)))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.setStaticCacheHeaders(w, "", false)
		handler.ServeHTTP(w, r)
	})
}

// fsHandlerWithFallback serves files from fs.FS with a fallback image for missing files
func (s *HTTPServer) fsHandlerWithFallback(
	prefix string,
	fsys fs.FS,
	subdir string,
	fallbackFile string,
) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract filename from path
		urlPath := strings.TrimPrefix(r.URL.Path, prefix)
		filePath := subdir + "/" + urlPath

		// Try to read the requested file
		data, err := fs.ReadFile(fsys, filePath)
		if err != nil {
			// File not found - serve fallback
			fallbackPath := subdir + "/" + fallbackFile
			data, err = fs.ReadFile(fsys, fallbackPath)
			if err != nil {
				http.NotFound(w, r)
				return
			}
		}

		s.setStaticCacheHeaders(w, "", false)
		w.Header().Set("Content-Type", "image/webp")
		http.ServeContent(w, r, urlPath, time.Time{}, bytes.NewReader(data))
	})
}

// gzipFSHandlerDirect serves files directly from fs.FS with gzip support
// It looks for pre-compressed .gz files first
func (s *HTTPServer) gzipFSHandlerDirect(prefix string, fsys fs.FS) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		urlPath := strings.TrimPrefix(r.URL.Path, prefix)
		acceptsGzip := strings.Contains(r.Header.Get("Accept-Encoding"), "gzip")

		body, gzipped, err := readAsset(fsys, urlPath, acceptsGzip)
		if err != nil {
			http.NotFound(w, r)
			return
		}

		if gzipped {
			w.Header().Set("Content-Encoding", "gzip")
			// ServeContent would slice the gzip stream, and a slice of it cannot be inflated.
			r.Header.Del("Range")
		}
		setContentType(w, urlPath)
		s.setStaticCacheHeaders(w, "Accept-Encoding", gzipped)
		http.ServeContent(w, r, urlPath, time.Time{}, bytes.NewReader(body))
	})
}

// readAsset prefers a pre-compressed sibling, then falls back to compressing on
// the fly. It reports whether the returned bytes are gzip-encoded.
func readAsset(fsys fs.FS, urlPath string, acceptsGzip bool) (body []byte, gzipped bool, err error) {
	if acceptsGzip {
		if data, err := fs.ReadFile(fsys, urlPath+".gz"); err == nil {
			return data, true, nil
		}
	}

	data, err := fs.ReadFile(fsys, urlPath)
	if err != nil {
		return nil, false, err
	}

	if !acceptsGzip || len(data) <= 1024 {
		return data, false, nil
	}

	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	if _, err := gz.Write(data); err != nil {
		return nil, false, err
	}
	if err := gz.Close(); err != nil {
		return nil, false, err
	}
	return buf.Bytes(), true, nil
}

// setContentType sets Content-Type header based on file extension
func setContentType(w http.ResponseWriter, path string) {
	switch {
	case strings.HasSuffix(path, ".js"):
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	case strings.HasSuffix(path, ".css"):
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
	case strings.HasSuffix(path, ".json"):
		w.Header().Set("Content-Type", "application/json")
	case strings.HasSuffix(path, ".xml"):
		w.Header().Set("Content-Type", "application/xml")
	}
}

// Start starts the HTTP server
func (s *HTTPServer) Start() error {
	addr := fmt.Sprintf(":%d", s.port)
	s.server = &http.Server{
		Addr:              addr,
		Handler:           s.mux,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	return s.server.ListenAndServe()
}

// Shutdown gracefully shuts down the HTTP server
func (s *HTTPServer) Shutdown(ctx context.Context) error {
	// Close all WebSocket connections first
	if s.wsHandler != nil {
		s.wsHandler.CloseAllClients()
	}

	if s.server != nil {
		return s.server.Shutdown(ctx)
	}
	return nil
}

// WebSocketHandler returns the WebSocket handler for broadcasting
func (s *HTTPServer) WebSocketHandler() *WebSocketHandler {
	return s.wsHandler
}
