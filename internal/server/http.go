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
}

// NewHTTPServer creates a new HTTP server with embedded assets (production mode)
func NewHTTPServer(
	port int,
	images, scripts, public, sounds embed.FS,
	wsHandler *WebSocketHandler,
	log *logger.Logger,
) *HTTPServer {
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

	s := &HTTPServer{
		port:      port,
		mux:       http.NewServeMux(),
		logger:    log,
		wsHandler: wsHandler,
		images:    imagesFS,
		scripts:   scriptsFS,
		public:    publicFS,
		sounds:    soundsFS,
	}
	s.setupRoutes()
	return s
}

// NewHTTPServerDev creates a new HTTP server reading from filesystem (dev mode)
func NewHTTPServerDev(port int, appDir string, wsHandler *WebSocketHandler, log *logger.Logger) *HTTPServer {
	s := &HTTPServer{
		port:      port,
		mux:       http.NewServeMux(),
		logger:    log,
		wsHandler: wsHandler,
		images:    os.DirFS(appDir + "/web/images"),
		scripts:   os.DirFS(appDir + "/web/scripts"),
		public:    os.DirFS(appDir + "/web/public"),
		sounds:    os.DirFS(appDir + "/web/sounds"),
	}
	s.setupRoutes()
	return s
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

	// SPA routes - serve index.html for all SPA paths
	spaRoutes := []string{
		"/",
		"/home",
		"/players",
		"/resources",
		"/enemies",
		"/chests",
		"/map",
		"/ignorelist",
		"/settings",
		"/spa",
	}
	for _, route := range spaRoutes {
		s.mux.HandleFunc(route, func(w http.ResponseWriter, r *http.Request) {
			s.serveFile(w, r, s.public, "index.html")
		})
	}

	// Radar overlay
	s.mux.HandleFunc("/radar-overlay", func(w http.ResponseWriter, r *http.Request) {
		s.serveFile(w, r, s.public, "radar-overlay.html")
	})

	// Static file handlers with caching
	s.mux.Handle("/images/", s.fsHandler("/images/", s.images, imageCacheDuration))
	s.mux.Handle("/scripts/", s.fsHandler("/scripts/", s.scripts, 0))
	s.mux.Handle("/sounds/", s.fsHandler("/sounds/", s.sounds, 0))
	s.mux.Handle("/public/", s.fsHandler("/public/", s.public, 0))
	s.mux.Handle("/pages/", s.fsHandlerSub("/pages/", s.public, "pages", 0))

	// ao-bin-dumps with gzip support
	s.mux.Handle(
		"/ao-bin-dumps/",
		s.gzipFSHandler("/ao-bin-dumps/", s.public, "ao-bin-dumps", dataCacheDuration),
	)

	// API endpoints
	s.mux.HandleFunc("/api/settings/server-logs", s.handleServerLogs)
}

// serveFile serves a single file from fs.FS
func (s *HTTPServer) serveFile(w http.ResponseWriter, _ *http.Request, fsys fs.FS, name string) {
	data, err := fs.ReadFile(fsys, name)
	if err != nil {
		http.Error(w, "Not Found", http.StatusNotFound)
		return
	}
	// Set content type based on extension
	if strings.HasSuffix(name, ".html") {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
	}
	_, _ = w.Write(data) // Error ignored: client disconnect is not recoverable
}

// setCacheHeaders sets Cache-Control and optional Vary headers
func setCacheHeaders(
	w http.ResponseWriter,
	duration time.Duration,
	mustRevalidate bool,
	vary string,
) {
	if duration > 0 {
		if mustRevalidate {
			w.Header().
				Set("Cache-Control", fmt.Sprintf("public, max-age=%d, must-revalidate", int(duration.Seconds())))
		} else {
			w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d", int(duration.Seconds())))
		}
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
) http.Handler {
	handler := http.StripPrefix(prefix, http.FileServer(http.FS(fsys)))

	if cacheDuration > 0 {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			setCacheHeaders(w, cacheDuration, false, "")
			handler.ServeHTTP(w, r)
		})
	}
	return handler
}

// fsHandlerSub creates a file server handler from a subdirectory of fs.FS
func (s *HTTPServer) fsHandlerSub(
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
	return s.fsHandler(prefix, subFS, cacheDuration)
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
				setCacheHeaders(w, cacheDuration, true, "Accept-Encoding")
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
		setCacheHeaders(w, cacheDuration, true, "Accept-Encoding")

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
		Addr:    addr,
		Handler: s.mux,
	}
	fmt.Printf("Server started on http://localhost%s\n", addr)
	fmt.Printf("WebSocket available at ws://localhost%s/ws\n", addr)
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
