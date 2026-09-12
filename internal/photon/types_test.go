package photon

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestByteArray_MarshalJSON_BufferShape(t *testing.T) {
	ba := ByteArray{0x01, 0x02, 0xff}
	out, err := json.Marshal(ba)
	require.NoError(t, err)
	require.JSONEq(t, `{"type":"Buffer","data":[1,2,255]}`, string(out))
}
