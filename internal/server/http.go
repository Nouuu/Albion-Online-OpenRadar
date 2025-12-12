package server

import (
	"compress/gzip"
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

// HTTPServer serves static files from embedded assets or filesystem
type HTTPServer struct {
	port   int
	mux    *http.ServeMux
	logger *logger.Logger
	// Filesystems (can be embed.FS or os.DirFS)
	images  fs.FS
	scripts fs.FS
	public  fs.FS
	sounds  fs.FS
}

// NewHTTPServer creates a new HTTP server with embedded assets (production mode)
func NewHTTPServer(port int, images, scripts, public, sounds embed.FS, log *logger.Logger) *HTTPServer {
	// Extract subdirectories from embed.FS (they include the folder path)
	imagesFS, _ := fs.Sub(images, "web/images")
	scriptsFS, _ := fs.Sub(scripts, "web/scripts")
	publicFS, _ := fs.Sub(public, "web/public")
	soundsFS, _ := fs.Sub(sounds, "web/sounds")

	s := &HTTPServer{
		port:    port,
		mux:     http.NewServeMux(),
		logger:  log,
		images:  imagesFS,
		scripts: scriptsFS,
		public:  publicFS,
		sounds:  soundsFS,
	}
	s.setupRoutes()
	return s
}

// NewHTTPServerDev creates a new HTTP server reading from filesystem (dev mode)
func NewHTTPServerDev(port int, appDir string, log *logger.Logger) *HTTPServer {
	s := &HTTPServer{
		port:    port,
		mux:     http.NewServeMux(),
		logger:  log,
		images:  os.DirFS(appDir + "/web/images"),
		scripts: os.DirFS(appDir + "/web/scripts"),
		public:  os.DirFS(appDir + "/web/public"),
		sounds:  os.DirFS(appDir + "/web/sounds"),
	}
	s.setupRoutes()
	return s
}

// setupRoutes configures all HTTP routes
func (s *HTTPServer) setupRoutes() {
	// Cache durations
	imageCacheDuration := 24 * time.Hour
	dataCacheDuration := 7 * 24 * time.Hour

	// SPA routes - serve index.html for all SPA paths
	spaRoutes := []string{"/", "/home", "/players", "/resources", "/enemies", "/chests", "/map", "/ignorelist", "/settings", "/spa"}
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
	s.mux.Handle("/ao-bin-dumps/", s.gzipFSHandler("/ao-bin-dumps/", s.public, "ao-bin-dumps", dataCacheDuration))

	// API endpoints
	s.mux.HandleFunc("/api/settings/server-logs", s.handleServerLogs)
}

// serveFile serves a single file from fs.FS
func (s *HTTPServer) serveFile(w http.ResponseWriter, r *http.Request, fsys fs.FS, name string) {
	data, err := fs.ReadFile(fsys, name)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	// Set content type based on extension
	if strings.HasSuffix(name, ".html") {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
	}
	w.Write(data)
}

// fsHandler creates a file server handler from fs.FS
func (s *HTTPServer) fsHandler(prefix string, fsys fs.FS, cacheDuration time.Duration) http.Handler {
	handler := http.StripPrefix(prefix, http.FileServer(http.FS(fsys)))

	if cacheDuration > 0 {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d", int(cacheDuration.Seconds())))
			handler.ServeHTTP(w, r)
		})
	}
	return handler
}

// fsHandlerSub creates a file server handler from a subdirectory of fs.FS
func (s *HTTPServer) fsHandlerSub(prefix string, fsys fs.FS, subdir string, cacheDuration time.Duration) http.Handler {
	subFS, err := fs.Sub(fsys, subdir)
	if err != nil {
		return http.NotFoundHandler()
	}
	return s.fsHandler(prefix, subFS, cacheDuration)
}

// gzipFSHandler serves files from fs.FS with gzip support
// It looks for pre-compressed .gz files first
func (s *HTTPServer) gzipFSHandler(prefix string, fsys fs.FS, subdir string, cacheDuration time.Duration) http.Handler {
	subFS, err := fs.Sub(fsys, subdir)
	if err != nil {
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
				if strings.HasSuffix(urlPath, ".json") {
					w.Header().Set("Content-Type", "application/json")
				} else if strings.HasSuffix(urlPath, ".xml") {
					w.Header().Set("Content-Type", "application/xml")
				}
				w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d, must-revalidate", int(cacheDuration.Seconds())))
				w.Header().Set("Vary", "Accept-Encoding")
				w.Write(data)
				return
			}
		}

		// Try serving original file
		data, err := fs.ReadFile(subFS, urlPath)
		if err != nil {
			http.NotFound(w, r)
			return
		}

		// Set content type
		if strings.HasSuffix(urlPath, ".json") {
			w.Header().Set("Content-Type", "application/json")
		} else if strings.HasSuffix(urlPath, ".xml") {
			w.Header().Set("Content-Type", "application/xml")
		}

		w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d, must-revalidate", int(cacheDuration.Seconds())))
		w.Header().Set("Vary", "Accept-Encoding")

		// Compress on the fly if large and client accepts gzip
		if acceptsGzip && len(data) > 1024 {
			w.Header().Set("Content-Encoding", "gzip")
			gz := gzip.NewWriter(w)
			gz.Write(data)
			gz.Close()
			return
		}

		w.Write(data)
	})
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
		json.NewEncoder(w).Encode(map[string]bool{"enabled": enabled})

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
		json.NewEncoder(w).Encode(map[string]interface{}{
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
	fmt.Printf("🌐 HTTP server started on http://localhost%s\n", addr)
	return http.ListenAndServe(addr, s.mux)
}
