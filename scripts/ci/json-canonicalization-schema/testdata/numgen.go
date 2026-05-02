//
//  Copyright 2006-2021 WebPKI.org (http://webpki.org).
//
//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//      https://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.
//

// numgen generates "es6testfile100m.txt.gz".
//
// Run the program with:
//	go run numgen.go
//
// Go 1.13 or latter is required due to a rounding bug in strconv.FormatFloat.
// See https://golang.org/issue/29491.
package main

import (
	"compress/gzip"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"io"
	"log"
	"math"
	"os"
	"strconv"
	"time"
)

const (
	outputFile = "es6testfile100m.txt.gz"
	numLines   = 1e8
)

// generator returns a function that generates the next float64 to format.
func generator() func() float64 {
	static := [...]uint64{
		0x0000000000000000, 0x8000000000000000, 0x0000000000000001, 0x8000000000000001,
		0xc46696695dbd1cc3, 0xc43211ede4974a35, 0xc3fce97ca0f21056, 0xc3c7213080c1a6ac,
		0xc39280f39a348556, 0xc35d9b1f5d20d557, 0xc327af4c4a80aaac, 0xc2f2f2a36ecd5556,
		0xc2be51057e155558, 0xc28840d131aaaaac, 0xc253670dc1555557, 0xc21f0b4935555557,
		0xc1e8d5d42aaaaaac, 0xc1b3de4355555556, 0xc17fca0555555556, 0xc1496e6aaaaaaaab,
		0xc114585555555555, 0xc0e046aaaaaaaaab, 0xc0aa0aaaaaaaaaaa, 0xc074d55555555555,
		0xc040aaaaaaaaaaab, 0xc00aaaaaaaaaaaab, 0xbfd5555555555555, 0xbfa1111111111111,
		0xbf6b4e81b4e81b4f, 0xbf35d867c3ece2a5, 0xbf0179ec9cbd821e, 0xbecbf647612f3696,
		0xbe965e9f80f29212, 0xbe61e54c672874db, 0xbe2ca213d840baf8, 0xbdf6e80fe033c8c6,
		0xbdc2533fe68fd3d2, 0xbd8d51ffd74c861c, 0xbd5774ccac3d3817, 0xbd22c3d6f030f9ac,
		0xbcee0624b3818f79, 0xbcb804ea293472c7, 0xbc833721ba905bd3, 0xbc4ebe9c5db3c61e,
		0xbc18987d17c304e5, 0xbbe3ad30dfcf371d, 0xbbaf7b816618582f, 0xbb792f9ab81379bf,
		0xbb442615600f9499, 0xbb101e77800c76e1, 0xbad9ca58cce0be35, 0xbaa4a1e0a3e6fe90,
		0xba708180831f320d, 0xba3a68cd9e985016, 0x446696695dbd1cc3, 0x443211ede4974a35,
		0x43fce97ca0f21056, 0x43c7213080c1a6ac, 0x439280f39a348556, 0x435d9b1f5d20d557,
		0x4327af4c4a80aaac, 0x42f2f2a36ecd5556, 0x42be51057e155558, 0x428840d131aaaaac,
		0x4253670dc1555557, 0x421f0b4935555557, 0x41e8d5d42aaaaaac, 0x41b3de4355555556,
		0x417fca0555555556, 0x41496e6aaaaaaaab, 0x4114585555555555, 0x40e046aaaaaaaaab,
		0x40aa0aaaaaaaaaaa, 0x4074d55555555555, 0x4040aaaaaaaaaaab, 0x400aaaaaaaaaaaab,
		0x3fd5555555555555, 0x3fa1111111111111, 0x3f6b4e81b4e81b4f, 0x3f35d867c3ece2a5,
		0x3f0179ec9cbd821e, 0x3ecbf647612f3696, 0x3e965e9f80f29212, 0x3e61e54c672874db,
		0x3e2ca213d840baf8, 0x3df6e80fe033c8c6, 0x3dc2533fe68fd3d2, 0x3d8d51ffd74c861c,
		0x3d5774ccac3d3817, 0x3d22c3d6f030f9ac, 0x3cee0624b3818f79, 0x3cb804ea293472c7,
		0x3c833721ba905bd3, 0x3c4ebe9c5db3c61e, 0x3c18987d17c304e5, 0x3be3ad30dfcf371d,
		0x3baf7b816618582f, 0x3b792f9ab81379bf, 0x3b442615600f9499, 0x3b101e77800c76e1,
		0x3ad9ca58cce0be35, 0x3aa4a1e0a3e6fe90, 0x3a708180831f320d, 0x3a3a68cd9e985016,
		0x4024000000000000, 0x4014000000000000, 0x3fe0000000000000, 0x3fa999999999999a,
		0x3f747ae147ae147b, 0x3f40624dd2f1a9fc, 0x3f0a36e2eb1c432d, 0x3ed4f8b588e368f1,
		0x3ea0c6f7a0b5ed8d, 0x3e6ad7f29abcaf48, 0x3e35798ee2308c3a, 0x3ed539223589fa95,
		0x3ed4ff26cd5a7781, 0x3ed4f95a762283ff, 0x3ed4f8c60703520c, 0x3ed4f8b72f19cd0d,
		0x3ed4f8b5b31c0c8d, 0x3ed4f8b58d1c461a, 0x3ed4f8b5894f7f0e, 0x3ed4f8b588ee37f3,
		0x3ed4f8b588e47da4, 0x3ed4f8b588e3849c, 0x3ed4f8b588e36bb5, 0x3ed4f8b588e36937,
		0x3ed4f8b588e368f8, 0x3ed4f8b588e368f1, 0x3ff0000000000000, 0xbff0000000000000,
		0xbfeffffffffffffa, 0xbfeffffffffffffb, 0x3feffffffffffffa, 0x3feffffffffffffb,
		0x3feffffffffffffc, 0x3feffffffffffffe, 0xbfefffffffffffff, 0xbfefffffffffffff,
		0x3fefffffffffffff, 0x3fefffffffffffff, 0x3fd3333333333332, 0x3fd3333333333333,
		0x3fd3333333333334, 0x0010000000000000, 0x000ffffffffffffd, 0x000fffffffffffff,
		0x7fefffffffffffff, 0xffefffffffffffff, 0x4340000000000000, 0xc340000000000000,
		0x4430000000000000, 0x44b52d02c7e14af5, 0x44b52d02c7e14af6, 0x44b52d02c7e14af7,
		0x444b1ae4d6e2ef4e, 0x444b1ae4d6e2ef4f, 0x444b1ae4d6e2ef50, 0x3eb0c6f7a0b5ed8c,
		0x3eb0c6f7a0b5ed8d, 0x41b3de4355555553, 0x41b3de4355555554, 0x41b3de4355555555,
		0x41b3de4355555556, 0x41b3de4355555557, 0xbecbf647612f3696, 0x43143ff3c1cb0959,
	}
	var state struct {
		idx   int
		data  []byte
		block [sha256.Size]byte
	}
	return func() float64 {
		const numSerial = 2000
		var f float64
		switch {
		case state.idx < len(static):
			f = math.Float64frombits(static[state.idx])
		case state.idx < len(static)+numSerial:
			f = math.Float64frombits(0x0010000000000000 + uint64(state.idx-len(static)))
		default:
			for f == 0 || math.IsNaN(f) || math.IsInf(f, 0) {
				if len(state.data) == 0 {
					state.block = sha256.Sum256(state.block[:])
					state.data = state.block[:]
				}
				f = math.Float64frombits(binary.LittleEndian.Uint64(state.data))
				state.data = state.data[8:]
			}
		}
		state.idx++
		return f
	}
}

// appendNumber implements canonical number formatting per RFC 8785, section 3.2.2.3.
func appendNumber(b []byte, f float64) []byte {
	if f == 0 {
		f = 0 // normalize -0 as 0
	}
	fmt := byte('f')
	if abs := math.Abs(f); abs != 0 && abs < 1e-6 || abs >= 1e21 {
		fmt = 'e'
	}
	b = strconv.AppendFloat(b, f, fmt, -1, 64)
	if fmt == 'e' {
		n := len(b)
		if n >= 4 && b[n-4] == 'e' && b[n-3] == '-' && b[n-2] == '0' {
			b[n-2] = b[n-1]
			b = b[:n-1]
		}
	}
	return b
}

// Generate a compressed es6testfile100m.txt.gz file.
func main() {
	// Create a new output file.
	f, err := os.OpenFile(outputFile, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0664)
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()

	// Compress the output.
	z, err := gzip.NewWriterLevel(f, gzip.BestCompression)
	if err != nil {
		log.Fatal(err)
	}
	defer z.Close()

	// Hash the file (before compression is applied).
	h := sha256.New()
	w := io.MultiWriter(h, z)

	// Format a large quantity of floating-point numbers.
	var b []byte
	var size int64
	type record struct {
		hash  []byte
		lines int
		size  int64
	}
	var records []record
	next := generator()
	recordAt := 1000
	start := time.Now()
	lastPrint := start
	for n := 1; n <= numLines; n++ {
		f := next()
		b = strconv.AppendUint(b[:0], math.Float64bits(f), 16)
		b = append(b, ',')
		b = appendNumber(b, f)
		b = append(b, '\n')
		if _, err := w.Write(b); err != nil {
			log.Fatal(err)
		}
		size += int64(len(b))

		if n == recordAt {
			records = append(records, record{h.Sum(nil), n, size})
			recordAt *= 10
		}

		if now := time.Now(); now.Sub(lastPrint) > time.Second || n == numLines {
			log.Printf("%0.3f%%", 100.0*float64(n)/float64(numLines))
			lastPrint = now
		}
	}
	end := time.Now()
	log.Printf("finished in %v", end.Sub(start))

	// Print records.
	for _, r := range records {
		fmt.Printf("hash:%x lines:%d size:%d\n", r.hash, r.lines, r.size)
	}
}
