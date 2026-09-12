package templates

import (
	"reflect"
	"testing"
)

func TestFuncMapDict(t *testing.T) {
	dict, ok := FuncMap()["dict"].(func(...any) map[string]any)
	if !ok {
		t.Fatal("dict has unexpected signature")
	}
	cases := []struct {
		name string
		in   []any
		want map[string]any
	}{
		{"pairs", []any{"a", 1, "b", "x"}, map[string]any{"a": 1, "b": "x"}},
		{"empty", nil, map[string]any{}},
		{"odd count", []any{"a"}, nil},
		{"non-string key skipped", []any{1, "v", "k", 2}, map[string]any{"k": 2}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := dict(tc.in...); !reflect.DeepEqual(got, tc.want) {
				t.Errorf("dict(%v) = %v, want %v", tc.in, got, tc.want)
			}
		})
	}
}
