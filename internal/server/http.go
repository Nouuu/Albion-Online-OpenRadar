package server

import (
	"compress/gzip"
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"strings"
	"time"

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
	public  fs.FS
	sounds  fs.FS
	styles  fs.FS
	// Template engine
	tmpl    *templates.Engine
	version string
}

// NewHTTPServer creates a new HTTP server with embedded assets (production mode)
func NewHTTPServer(
	port int,
	images, scripts, public, sounds, styles, tmplFS embed.FS,
	wsHandler *WebSocketHandler,
	log *logger.Logger,
	version string,
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
	publicFS, err := fs.Sub(public, "web/public")
	if err != nil {
		fmt.Printf("[HTTP] Warning: failed to load public: %v\n", err)
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
		public:    publicFS,
		sounds:    soundsFS,
		styles:    stylesFS,
		tmpl:      tmpl,
		version:   version,
	}
	s.setupRoutes()
	return s, nil
}

// NewHTTPServerDev creates a new HTTP server reading from filesystem (dev mode)
func NewHTTPServerDev(port int, appDir string, wsHandler *WebSocketHandler, log *logger.Logger, version string) (*HTTPServer, error) {
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
		public:    os.DirFS(appDir + "/web/public"),
		sounds:    os.DirFS(appDir + "/web/sounds"),
		styles:    os.DirFS(appDir + "/web/styles"),
		tmpl:      tmpl,
		version:   version,
	}
	s.setupRoutes()
	return s, nil
}

// setupRoutes configures all HTTP routes
func (s *HTTPServer) setupRoutes() {
	// Cache durations
	imageCacheDuration := 24 * time.Hour
	dataCacheDuration := 7 * 24 * time.Hour

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

	// Radar overlay
	s.mux.HandleFunc("/radar-overlay", func(w http.ResponseWriter, r *http.Request) {
		s.renderOverlay(w)
	})

	// Static file handlers with caching
	// Items and Spells: serve fallback image if not found
	s.mux.Handle("/images/Items/", s.fsHandlerWithFallback("/images/Items/", s.images, "Items", "_default.webp", imageCacheDuration))
	s.mux.Handle("/images/Spells/", s.fsHandlerWithFallback("/images/Spells/", s.images, "Spells", "_default.webp", imageCacheDuration))
	// Other images: standard handler (cache 24h)
	s.mux.Handle("/images/", s.fsHandler("/images/", s.images, imageCacheDuration, false))
	// Scripts, pages: NO CACHE (for development)
	s.mux.Handle("/scripts/", s.fsHandler("/scripts/", s.scripts, 0, true))
	s.mux.Handle("/sounds/", s.fsHandler("/sounds/", s.sounds, 0, false))
	s.mux.Handle("/public/", s.fsHandler("/public/", s.public, 0, true))
	s.mux.Handle("/pages/", s.fsHandlerSub("/pages/", s.public, "pages", 0, true))
	// Styles: NO CACHE (for development)
	s.mux.Handle("/styles/", s.fsHandler("/styles/", s.styles, 0, true))

	// ao-bin-dumps with gzip support
	s.mux.Handle(
		"/ao-bin-dumps/",
		s.gzipFSHandler("/ao-bin-dumps/", s.public, "ao-bin-dumps", dataCacheDuration),
	)

	// API endpoints
	s.mux.HandleFunc("/api/settings/server-logs", s.handleServerLogs)
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
	if title == "" {
		title = strings.Title(page)
	}

	data := templates.NewPageData(page, "OpenRadar - "+title).WithVersion(s.version)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")

	// Check if this is an HTMX request (SPA navigation)
	isHTMX := r.Header.Get("HX-Request") == "true"

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
	}
}

// renderOverlay renders the radar overlay template
func (s *HTTPServer) renderOverlay(w http.ResponseWriter) {
	data := templates.NewPageData("overlay", "OpenRadar - Radar Overlay").WithVersion(s.version)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")

	if err := s.tmpl.Render(w, "overlay/radar-overlay.gohtml", data); err != nil {
		s.logger.Error("http", "render", fmt.Sprintf("Failed to render overlay: %v", err), nil)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

// serveFile serves a single file from fs.FS
func (s *HTTPServer) serveFile(w http.ResponseWriter, _ *http.Request, fsys fs.FS, name string) {
	data, err := fs.ReadFile(fsys, name)
	if err != nil {
		http.Error(w, "Not Found", http.StatusNotFound)
		return
	}
	// Set content type and no-cache for HTML files
	if strings.HasSuffix(name, ".html") {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")
	}
	_, _ = w.Write(data) // Error ignored: client disconnect is not recoverable
}

// setCacheHeaders sets Cache-Control and optional Vary headers
func setCacheHeaders(
	w http.ResponseWriter,
	duration time.Duration,
	noCache bool,
	vary string,
) {
	if noCache {
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")
	} else if duration > 0 {
		w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d", int(duration.Seconds())))
	}
	if vary != "" {
		w.Header().Set("Vary", vary)
	}
}

// fsHandler creates a file server handler from fs.FS
func (s *HTTPServer) fsHandler(
	prefix string,
	fsys fs.FS,
	cacheDuration time.Duration,
	noCache bool,
) http.Handler {
	handler := http.StripPrefix(prefix, http.FileServer(http.FS(fsys)))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		setCacheHeaders(w, cacheDuration, noCache, "")
		handler.ServeHTTP(w, r)
	})
}

// fsHandlerWithFallback serves files from fs.FS with a fallback image for missing files
func (s *HTTPServer) fsHandlerWithFallback(
	prefix string,
	fsys fs.FS,
	subdir string,
	fallbackFile string,
	cacheDuration time.Duration,
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

		// Set headers
		setCacheHeaders(w, cacheDuration, false, "")
		w.Header().Set("Content-Type", "image/webp")
		_, _ = w.Write(data)
	})
}

// fsHandlerSub creates a file server handler from a subdirectory of fs.FS
func (s *HTTPServer) fsHandlerSub(
	prefix string,
	fsys fs.FS,
	subdir string,
	cacheDuration time.Duration,
	noCache bool,
) http.Handler {
	subFS, err := fs.Sub(fsys, subdir)
	if err != nil {
		fmt.Printf("[HTTP] Warning: failed to load subdirectory %s: %v\n", subdir, err)
		return http.NotFoundHandler()
	}
	return s.fsHandler(prefix, subFS, cacheDuration, noCache)
}

// gzipFSHandler serves files from fs.FS with gzip support
// It looks for pre-compressed .gz files first
func (s *HTTPServer) gzipFSHandler(
	prefix string,
	fsys fs.FS,
	subdir string,
	cacheDuration time.Duration,
) http.Handler {
	subFS, err := fs.Sub(fsys, subdir)
	if err != nil {
		fmt.Printf("[HTTP] Warning: failed to load subdirectory %s: %v\n", subdir, err)
		return http.NotFoundHandler()
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		urlPath := strings.TrimPrefix(r.URL.Path, prefix)
		acceptsGzip := strings.Contains(r.Header.Get("Accept-Encoding"), "gzip")

		// Try serving .gz file if client accepts gzip
		if acceptsGzip {
			gzPath := urlPath + ".gz"
			if data, err := fs.ReadFile(subFS, gzPath); err == nil {
				w.Header().Set("Content-Encoding", "gzip")
				setContentType(w, urlPath)
				setCacheHeaders(w, cacheDuration, false, "Accept-Encoding")
				_, _ = w.Write(data)
				return
			}
		}

		// Try serving original file
		data, err := fs.ReadFile(subFS, urlPath)
		if err != nil {
			http.NotFound(w, r)
			return
		}

		setContentType(w, urlPath)
		setCacheHeaders(w, cacheDuration, false, "Accept-Encoding")

		// Compress on the fly if large and client accepts gzip
		if acceptsGzip && len(data) > 1024 {
			w.Header().Set("Content-Encoding", "gzip")
			gz := gzip.NewWriter(w)
			_, _ = gz.Write(data)
			_ = gz.Close()
			return
		}

		_, _ = w.Write(data)
	})
}

// setContentType sets Content-Type header based on file extension
func setContentType(w http.ResponseWriter, path string) {
	switch {
	case strings.HasSuffix(path, ".json"):
		w.Header().Set("Content-Type", "application/json")
	case strings.HasSuffix(path, ".xml"):
		w.Header().Set("Content-Type", "application/xml")
	}
}

// handleServerLogs handles the server logs API
func (s *HTTPServer) handleServerLogs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case "GET":
		enabled := false
		if s.logger != nil {
			enabled = s.logger.IsEnabled()
		}
		_ = json.NewEncoder(w).Encode(map[string]bool{"enabled": enabled})

	case "POST":
		var req struct {
			Enabled bool `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"Invalid JSON"}`, http.StatusBadRequest)
			return
		}
		if s.logger != nil {
			s.logger.SetEnabled(req.Enabled)
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"enabled": s.logger != nil && s.logger.IsEnabled(),
		})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
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
