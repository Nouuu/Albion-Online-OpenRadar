package server

import (
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/nospy/albion-openradar/internal/logger"
)

// HTTPServer serves static files
type HTTPServer struct {
	port   int
	appDir string
	mux    *http.ServeMux
	logger *logger.Logger
}

// NewHTTPServer creates a new HTTP server
func NewHTTPServer(port int, appDir string, log *logger.Logger) *HTTPServer {
	s := &HTTPServer{
		port:   port,
		appDir: appDir,
		mux:    http.NewServeMux(),
		logger: log,
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
		route := route // capture for closure
		s.mux.HandleFunc(route, func(w http.ResponseWriter, r *http.Request) {
			http.ServeFile(w, r, filepath.Join(s.appDir, "public", "index.html"))
		})
	}

	// Radar overlay
	s.mux.HandleFunc("/radar-overlay", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, filepath.Join(s.appDir, "public", "radar-overlay.html"))
	})

	// Static file handlers with caching
	s.mux.Handle("/images/", s.staticHandler("/images/", filepath.Join(s.appDir, "images"), imageCacheDuration))
	s.mux.Handle("/scripts/", s.staticHandler("/scripts/", filepath.Join(s.appDir, "scripts"), 0))
	s.mux.Handle("/sounds/", s.staticHandler("/sounds/", filepath.Join(s.appDir, "sounds"), 0))
	s.mux.Handle("/public/", s.staticHandler("/public/", filepath.Join(s.appDir, "public"), 0))
	s.mux.Handle("/pages/", s.staticHandler("/pages/", filepath.Join(s.appDir, "public", "pages"), 0))

	// ao-bin-dumps with gzip support
	s.mux.Handle("/ao-bin-dumps/", s.gzipStaticHandler("/ao-bin-dumps/", filepath.Join(s.appDir, "public", "ao-bin-dumps"), dataCacheDuration))

	// API endpoints
	s.mux.HandleFunc("/api/settings/server-logs", s.handleServerLogs)
}

// staticHandler creates a file server with optional caching
func (s *HTTPServer) staticHandler(prefix, dir string, cacheDuration time.Duration) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	handler := http.StripPrefix(prefix, fs)

	if cacheDuration > 0 {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d", int(cacheDuration.Seconds())))
			handler.ServeHTTP(w, r)
		})
	}

	return handler
}

// gzipStaticHandler serves static files with gzip support
func (s *HTTPServer) gzipStaticHandler(prefix, dir string, cacheDuration time.Duration) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get the requested file path
		urlPath := strings.TrimPrefix(r.URL.Path, prefix)
		filePath := filepath.Join(dir, urlPath)

		// Check if client accepts gzip
		acceptsGzip := strings.Contains(r.Header.Get("Accept-Encoding"), "gzip")

		// Try serving .gz file if exists and client accepts gzip
		if acceptsGzip {
			gzPath := filePath + ".gz"
			if _, err := os.Stat(gzPath); err == nil {
				w.Header().Set("Content-Encoding", "gzip")
				if strings.HasSuffix(urlPath, ".json") {
					w.Header().Set("Content-Type", "application/json")
				} else if strings.HasSuffix(urlPath, ".xml") {
					w.Header().Set("Content-Type", "application/xml")
				}
				w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d, must-revalidate", int(cacheDuration.Seconds())))
				w.Header().Set("Vary", "Accept-Encoding")
				http.ServeFile(w, r, gzPath)
				return
			}
		}

		// Serve original file with dynamic compression for JSON/XML
		file, err := os.Open(filePath)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer file.Close()

		stat, err := file.Stat()
		if err != nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		// Set content type
		if strings.HasSuffix(urlPath, ".json") {
			w.Header().Set("Content-Type", "application/json")
		} else if strings.HasSuffix(urlPath, ".xml") {
			w.Header().Set("Content-Type", "application/xml")
		}

		// Set cache headers
		w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d, must-revalidate", int(cacheDuration.Seconds())))
		w.Header().Set("Vary", "Accept-Encoding")

		// Compress on the fly if file is large enough and client accepts gzip
		if acceptsGzip && stat.Size() > 1024 {
			w.Header().Set("Content-Encoding", "gzip")
			gz := gzip.NewWriter(w)
			defer gz.Close()
			io.Copy(gz, file)
			return
		}

		// Serve without compression
		http.ServeContent(w, r, filePath, stat.ModTime(), file)
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
