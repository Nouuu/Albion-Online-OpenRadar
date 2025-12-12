package templates

import (
	"bytes"
	"embed"
	"fmt"
	"html/template"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// Engine handles template parsing and rendering
type Engine struct {
	templates *template.Template
	mu        sync.RWMutex
	devMode   bool
	baseDir   string
}

// FuncMap returns the template function map with helper functions
func FuncMap() template.FuncMap {
	return template.FuncMap{
		// dict creates a map from key-value pairs for passing to templates
		"dict": func(values ...interface{}) map[string]interface{} {
			if len(values)%2 != 0 {
				return nil
			}
			d := make(map[string]interface{}, len(values)/2)
			for i := 0; i < len(values); i += 2 {
				key, ok := values[i].(string)
				if !ok {
					continue
				}
				d[key] = values[i+1]
			}
			return d
		},
		// seq generates a sequence of integers [0, n)
		"seq": func(n int) []int {
			result := make([]int, n)
			for i := range result {
				result[i] = i
			}
			return result
		},
		// add performs integer addition
		"add": func(a, b int) int {
			return a + b
		},
		// sub performs integer subtraction
		"sub": func(a, b int) int {
			return a - b
		},
		// eq checks equality (for use in templates)
		"eq": func(a, b interface{}) bool {
			return a == b
		},
		// contains checks if a string contains a substring
		"contains": func(s, substr string) bool {
			return strings.Contains(s, substr)
		},
		// lower converts string to lowercase
		"lower": func(s string) string {
			return strings.ToLower(s)
		},
		// upper converts string to uppercase
		"upper": func(s string) string {
			return strings.ToUpper(s)
		},
		// join joins strings with separator
		"join": func(sep string, items []string) string {
			return strings.Join(items, sep)
		},
		// safeHTML marks a string as safe HTML (no escaping)
		"safeHTML": func(s string) template.HTML {
			return template.HTML(s)
		},
		// safeAttr marks a string as safe attribute value
		"safeAttr": func(s string) template.HTMLAttr {
			return template.HTMLAttr(s)
		},
		// safeJS marks a string as safe JavaScript
		"safeJS": func(s string) template.JS {
			return template.JS(s)
		},
		// tierColor returns the Tailwind color class for a tier
		"tierColor": func(tier int) string {
			colors := map[int]string{
				1: "tier-1", 2: "tier-2", 3: "tier-3", 4: "tier-4",
				5: "tier-5", 6: "tier-6", 7: "tier-7", 8: "tier-8",
			}
			if c, ok := colors[tier]; ok {
				return c
			}
			return "gray-400"
		},
	}
}

// NewEngine creates a new template engine from embedded filesystem (production mode)
func NewEngine(fsys embed.FS, subdir string) (*Engine, error) {
	e := &Engine{
		devMode: false,
	}

	// Get the subdirectory from embed.FS
	sub, err := fs.Sub(fsys, subdir)
	if err != nil {
		return nil, fmt.Errorf("failed to access embedded templates: %w", err)
	}

	// Parse all templates
	t := template.New("").Funcs(FuncMap())
	err = fs.WalkDir(sub, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() || !strings.HasSuffix(path, ".gohtml") {
			return nil
		}

		content, err := fs.ReadFile(sub, path)
		if err != nil {
			return fmt.Errorf("failed to read template %s: %w", path, err)
		}

		// Use path as template name (e.g., "layouts/base.gohtml")
		name := path
		_, err = t.New(name).Parse(string(content))
		if err != nil {
			return fmt.Errorf("failed to parse template %s: %w", name, err)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	e.templates = t
	return e, nil
}

// NewEngineDev creates a new template engine reading from filesystem (development mode)
func NewEngineDev(baseDir string) (*Engine, error) {
	e := &Engine{
		devMode: true,
		baseDir: baseDir,
	}

	if err := e.reloadTemplates(); err != nil {
		return nil, err
	}

	return e, nil
}

// reloadTemplates reloads all templates from disk (dev mode only)
func (e *Engine) reloadTemplates() error {
	t := template.New("").Funcs(FuncMap())

	err := filepath.WalkDir(e.baseDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() || !strings.HasSuffix(path, ".gohtml") {
			return nil
		}

		content, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("failed to read template %s: %w", path, err)
		}

		// Get relative path as template name
		relPath, err := filepath.Rel(e.baseDir, path)
		if err != nil {
			return err
		}
		// Normalize path separators
		name := filepath.ToSlash(relPath)

		_, err = t.New(name).Parse(string(content))
		if err != nil {
			return fmt.Errorf("failed to parse template %s: %w", name, err)
		}

		return nil
	})

	if err != nil {
		return err
	}

	e.mu.Lock()
	e.templates = t
	e.mu.Unlock()

	return nil
}

// Render renders a template by name with the given data
func (e *Engine) Render(w io.Writer, name string, data interface{}) error {
	// In dev mode, reload templates on each render for hot reload
	if e.devMode {
		if err := e.reloadTemplates(); err != nil {
			return fmt.Errorf("failed to reload templates: %w", err)
		}
	}

	e.mu.RLock()
	t := e.templates.Lookup(name)
	e.mu.RUnlock()

	if t == nil {
		return fmt.Errorf("template %q not found", name)
	}

	return t.Execute(w, data)
}

// RenderString renders a template to a string
func (e *Engine) RenderString(name string, data interface{}) (string, error) {
	var buf bytes.Buffer
	if err := e.Render(&buf, name, data); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// RenderPage renders a page template with the base layout
func (e *Engine) RenderPage(w io.Writer, page string, data *PageData) error {
	// Set the page name in data
	if data == nil {
		data = &PageData{}
	}
	data.Page = page

	// Render using the base layout which includes the page content
	return e.Render(w, "layouts/base.gohtml", data)
}

// RenderPartial renders only the page content without the base layout (for HTMX requests)
func (e *Engine) RenderPartial(w io.Writer, page string, data *PageData) error {
	// Set the page name in data
	if data == nil {
		data = &PageData{}
	}
	data.Page = page

	// Render using the content template (partial, no full layout)
	return e.Render(w, "layouts/content.gohtml", data)
}

// HasTemplate checks if a template exists
func (e *Engine) HasTemplate(name string) bool {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.templates.Lookup(name) != nil
}

// ListTemplates returns a list of all loaded templates
func (e *Engine) ListTemplates() []string {
	e.mu.RLock()
	defer e.mu.RUnlock()

	var names []string
	for _, t := range e.templates.Templates() {
		if t.Name() != "" {
			names = append(names, t.Name())
		}
	}
	return names
}
