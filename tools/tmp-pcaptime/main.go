package main

import (
	"fmt"
	"os"
	"github.com/google/gopacket/pcapgo"
	"io"
	"errors"
)

func main() {
	f, _ := os.Open(os.Args[1])
	defer f.Close()
	r, err := pcapgo.NewReader(f)
	if err != nil { panic(err) }
	var first, last string
	count := 0
	for {
		_, ci, err := r.ReadPacketData()
		if errors.Is(err, io.EOF) { break }
		if err != nil { panic(err) }
		if first == "" { first = ci.Timestamp.Format("2006-01-02T15:04:05.000") }
		last = ci.Timestamp.Format("2006-01-02T15:04:05.000")
		count++
	}
	fmt.Println("packets:", count, "first:", first, "last:", last)
}
