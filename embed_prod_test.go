//go:build !dev

package assets

import (
	"io/fs"
	"strings"
	"testing"
)

func TestProdEmbedExcludesTestsAndFixtures(t *testing.T) {
	err := fs.WalkDir(Scripts, "web/scripts", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if strings.Contains(path, "__fixtures__") {
			t.Errorf("unexpected fixture in prod embed: %s", path)
		}
		if strings.HasSuffix(path, ".test.js") {
			t.Errorf("unexpected test file in prod embed: %s", path)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
