package lyrics

var qrcSBox = [8][64]byte{
	{14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7,
		0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8,
		4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0,
		15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13},
	{15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10,
		3, 13, 4, 7, 15, 2, 8, 15, 12, 0, 1, 10, 6, 9, 11, 5,
		0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15,
		13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9},
	{10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8,
		13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1,
		13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7,
		1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12},
	{7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15,
		13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9,
		10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4,
		3, 15, 0, 6, 10, 10, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14},
	{2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9,
		14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6,
		4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14,
		11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3},
	{12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11,
		10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8,
		9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6,
		4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13},
	{4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1,
		13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6,
		1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2,
		6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12},
	{13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7,
		1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2,
		7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8,
		2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11},
}

var qrcKeyRndShift = [16]uint32{1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1}
var qrcKeyPermC = [28]uint{56, 48, 40, 32, 24, 16, 8, 0, 57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35}
var qrcKeyPermD = [28]uint{62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 60, 52, 44, 36, 28, 20, 12, 4, 27, 19, 11, 3}
var qrcKeyComp = [48]uint32{13, 16, 10, 23, 0, 4, 2, 27, 14, 5, 20, 9, 22, 18, 11, 3, 25, 7, 15, 6, 26, 19, 12, 1, 40, 51, 30, 36, 46, 54, 29, 39, 50, 44, 32, 47, 43, 48, 38, 55, 33, 52, 45, 41, 49, 35, 28, 31}

type qrcRoundKeys [16][6]byte

type qrcTripleDES struct {
	keys [3]qrcRoundKeys
}

func newQRCTripleDESDecrypt(key []byte) qrcTripleDES {
	var fixed [24]byte
	copy(fixed[:], key)
	return qrcTripleDES{
		keys: [3]qrcRoundKeys{
			qrcKeySchedule(fixed[16:], false),
			qrcKeySchedule(fixed[8:], true),
			qrcKeySchedule(fixed[:], false),
		},
	}
}

func (q qrcTripleDES) decryptBlock(block []byte) [8]byte {
	buf := qrcDesCryptBlock(block, q.keys[0])
	buf = qrcDesCryptBlock(buf[:], q.keys[1])
	return qrcDesCryptBlock(buf[:], q.keys[2])
}

func qrcBitNum(data []byte, b uint, c uint32) uint32 {
	byteIndex := (b/32)*4 + 3 - (b%32)/8
	return (uint32((data[byteIndex]>>(7-(b%8)))&1) << c)
}

func qrcBitNumIntr(a uint32, b uint32, c uint32) uint32 {
	return ((a >> (31 - b)) & 1) << c
}

func qrcBitNumIntl(a uint32, b uint32, c uint32) uint32 {
	return ((a << b) & 0x80000000) >> c
}

func qrcSBoxBit(a uint32) int {
	return int((a & 32) | ((a & 31) >> 1) | ((a & 1) << 4))
}

func qrcInitialPermutation(data []byte) (uint32, uint32) {
	s0 := qrcBitNum(data, 57, 31) | qrcBitNum(data, 49, 30) | qrcBitNum(data, 41, 29) | qrcBitNum(data, 33, 28) |
		qrcBitNum(data, 25, 27) | qrcBitNum(data, 17, 26) | qrcBitNum(data, 9, 25) | qrcBitNum(data, 1, 24) |
		qrcBitNum(data, 59, 23) | qrcBitNum(data, 51, 22) | qrcBitNum(data, 43, 21) | qrcBitNum(data, 35, 20) |
		qrcBitNum(data, 27, 19) | qrcBitNum(data, 19, 18) | qrcBitNum(data, 11, 17) | qrcBitNum(data, 3, 16) |
		qrcBitNum(data, 61, 15) | qrcBitNum(data, 53, 14) | qrcBitNum(data, 45, 13) | qrcBitNum(data, 37, 12) |
		qrcBitNum(data, 29, 11) | qrcBitNum(data, 21, 10) | qrcBitNum(data, 13, 9) | qrcBitNum(data, 5, 8) |
		qrcBitNum(data, 63, 7) | qrcBitNum(data, 55, 6) | qrcBitNum(data, 47, 5) | qrcBitNum(data, 39, 4) |
		qrcBitNum(data, 31, 3) | qrcBitNum(data, 23, 2) | qrcBitNum(data, 15, 1) | qrcBitNum(data, 7, 0)
	s1 := qrcBitNum(data, 56, 31) | qrcBitNum(data, 48, 30) | qrcBitNum(data, 40, 29) | qrcBitNum(data, 32, 28) |
		qrcBitNum(data, 24, 27) | qrcBitNum(data, 16, 26) | qrcBitNum(data, 8, 25) | qrcBitNum(data, 0, 24) |
		qrcBitNum(data, 58, 23) | qrcBitNum(data, 50, 22) | qrcBitNum(data, 42, 21) | qrcBitNum(data, 34, 20) |
		qrcBitNum(data, 26, 19) | qrcBitNum(data, 18, 18) | qrcBitNum(data, 10, 17) | qrcBitNum(data, 2, 16) |
		qrcBitNum(data, 60, 15) | qrcBitNum(data, 52, 14) | qrcBitNum(data, 44, 13) | qrcBitNum(data, 36, 12) |
		qrcBitNum(data, 28, 11) | qrcBitNum(data, 20, 10) | qrcBitNum(data, 12, 9) | qrcBitNum(data, 4, 8) |
		qrcBitNum(data, 62, 7) | qrcBitNum(data, 54, 6) | qrcBitNum(data, 46, 5) | qrcBitNum(data, 38, 4) |
		qrcBitNum(data, 30, 3) | qrcBitNum(data, 22, 2) | qrcBitNum(data, 14, 1) | qrcBitNum(data, 6, 0)
	return s0, s1
}

func qrcInversePermutation(s0, s1 uint32) [8]byte {
	var data [8]byte
	data[3] = byte(qrcBitNumIntr(s1, 7, 7) | qrcBitNumIntr(s0, 7, 6) | qrcBitNumIntr(s1, 15, 5) | qrcBitNumIntr(s0, 15, 4) | qrcBitNumIntr(s1, 23, 3) | qrcBitNumIntr(s0, 23, 2) | qrcBitNumIntr(s1, 31, 1) | qrcBitNumIntr(s0, 31, 0))
	data[2] = byte(qrcBitNumIntr(s1, 6, 7) | qrcBitNumIntr(s0, 6, 6) | qrcBitNumIntr(s1, 14, 5) | qrcBitNumIntr(s0, 14, 4) | qrcBitNumIntr(s1, 22, 3) | qrcBitNumIntr(s0, 22, 2) | qrcBitNumIntr(s1, 30, 1) | qrcBitNumIntr(s0, 30, 0))
	data[1] = byte(qrcBitNumIntr(s1, 5, 7) | qrcBitNumIntr(s0, 5, 6) | qrcBitNumIntr(s1, 13, 5) | qrcBitNumIntr(s0, 13, 4) | qrcBitNumIntr(s1, 21, 3) | qrcBitNumIntr(s0, 21, 2) | qrcBitNumIntr(s1, 29, 1) | qrcBitNumIntr(s0, 29, 0))
	data[0] = byte(qrcBitNumIntr(s1, 4, 7) | qrcBitNumIntr(s0, 4, 6) | qrcBitNumIntr(s1, 12, 5) | qrcBitNumIntr(s0, 12, 4) | qrcBitNumIntr(s1, 20, 3) | qrcBitNumIntr(s0, 20, 2) | qrcBitNumIntr(s1, 28, 1) | qrcBitNumIntr(s0, 28, 0))
	data[7] = byte(qrcBitNumIntr(s1, 3, 7) | qrcBitNumIntr(s0, 3, 6) | qrcBitNumIntr(s1, 11, 5) | qrcBitNumIntr(s0, 11, 4) | qrcBitNumIntr(s1, 19, 3) | qrcBitNumIntr(s0, 19, 2) | qrcBitNumIntr(s1, 27, 1) | qrcBitNumIntr(s0, 27, 0))
	data[6] = byte(qrcBitNumIntr(s1, 2, 7) | qrcBitNumIntr(s0, 2, 6) | qrcBitNumIntr(s1, 10, 5) | qrcBitNumIntr(s0, 10, 4) | qrcBitNumIntr(s1, 18, 3) | qrcBitNumIntr(s0, 18, 2) | qrcBitNumIntr(s1, 26, 1) | qrcBitNumIntr(s0, 26, 0))
	data[5] = byte(qrcBitNumIntr(s1, 1, 7) | qrcBitNumIntr(s0, 1, 6) | qrcBitNumIntr(s1, 9, 5) | qrcBitNumIntr(s0, 9, 4) | qrcBitNumIntr(s1, 17, 3) | qrcBitNumIntr(s0, 17, 2) | qrcBitNumIntr(s1, 25, 1) | qrcBitNumIntr(s0, 25, 0))
	data[4] = byte(qrcBitNumIntr(s1, 0, 7) | qrcBitNumIntr(s0, 0, 6) | qrcBitNumIntr(s1, 8, 5) | qrcBitNumIntr(s0, 8, 4) | qrcBitNumIntr(s1, 16, 3) | qrcBitNumIntr(s0, 16, 2) | qrcBitNumIntr(s1, 24, 1) | qrcBitNumIntr(s0, 24, 0))
	return data
}

func qrcFeistelF(state uint32, key [6]byte) uint32 {
	t1 := qrcBitNumIntl(state, 31, 0) | ((state & 0xf0000000) >> 1) | qrcBitNumIntl(state, 4, 5) |
		qrcBitNumIntl(state, 3, 6) | ((state & 0x0f000000) >> 3) | qrcBitNumIntl(state, 8, 11) |
		qrcBitNumIntl(state, 7, 12) | ((state & 0x00f00000) >> 5) | qrcBitNumIntl(state, 12, 17) |
		qrcBitNumIntl(state, 11, 18) | ((state & 0x000f0000) >> 7) | qrcBitNumIntl(state, 16, 23)
	t2 := qrcBitNumIntl(state, 15, 0) | ((state & 0x0000f000) << 15) | qrcBitNumIntl(state, 20, 5) |
		qrcBitNumIntl(state, 19, 6) | ((state & 0x00000f00) << 13) | qrcBitNumIntl(state, 24, 11) |
		qrcBitNumIntl(state, 23, 12) | ((state & 0x000000f0) << 11) | qrcBitNumIntl(state, 28, 17) |
		qrcBitNumIntl(state, 27, 18) | ((state & 0x0000000f) << 9) | qrcBitNumIntl(state, 0, 23)

	lg := [6]byte{
		byte(t1>>24) ^ key[0],
		byte(t1>>16) ^ key[1],
		byte(t1>>8) ^ key[2],
		byte(t2>>24) ^ key[3],
		byte(t2>>16) ^ key[4],
		byte(t2>>8) ^ key[5],
	}

	st := uint32(qrcSBox[0][qrcSBoxBit(uint32(lg[0]>>2))])<<28 |
		uint32(qrcSBox[1][qrcSBoxBit(uint32(((lg[0]&0x03)<<4)|(lg[1]>>4)))])<<24 |
		uint32(qrcSBox[2][qrcSBoxBit(uint32(((lg[1]&0x0f)<<2)|(lg[2]>>6)))])<<20 |
		uint32(qrcSBox[3][qrcSBoxBit(uint32(lg[2]&0x3f))])<<16 |
		uint32(qrcSBox[4][qrcSBoxBit(uint32(lg[3]>>2))])<<12 |
		uint32(qrcSBox[5][qrcSBoxBit(uint32(((lg[3]&0x03)<<4)|(lg[4]>>4)))])<<8 |
		uint32(qrcSBox[6][qrcSBoxBit(uint32(((lg[4]&0x0f)<<2)|(lg[5]>>6)))])<<4 |
		uint32(qrcSBox[7][qrcSBoxBit(uint32(lg[5]&0x3f))])

	return qrcBitNumIntl(st, 15, 0) | qrcBitNumIntl(st, 6, 1) | qrcBitNumIntl(st, 19, 2) | qrcBitNumIntl(st, 20, 3) |
		qrcBitNumIntl(st, 28, 4) | qrcBitNumIntl(st, 11, 5) | qrcBitNumIntl(st, 27, 6) | qrcBitNumIntl(st, 16, 7) |
		qrcBitNumIntl(st, 0, 8) | qrcBitNumIntl(st, 14, 9) | qrcBitNumIntl(st, 22, 10) | qrcBitNumIntl(st, 25, 11) |
		qrcBitNumIntl(st, 4, 12) | qrcBitNumIntl(st, 17, 13) | qrcBitNumIntl(st, 30, 14) | qrcBitNumIntl(st, 9, 15) |
		qrcBitNumIntl(st, 1, 16) | qrcBitNumIntl(st, 7, 17) | qrcBitNumIntl(st, 23, 18) | qrcBitNumIntl(st, 13, 19) |
		qrcBitNumIntl(st, 31, 20) | qrcBitNumIntl(st, 26, 21) | qrcBitNumIntl(st, 2, 22) | qrcBitNumIntl(st, 8, 23) |
		qrcBitNumIntl(st, 18, 24) | qrcBitNumIntl(st, 12, 25) | qrcBitNumIntl(st, 29, 26) | qrcBitNumIntl(st, 5, 27) |
		qrcBitNumIntl(st, 21, 28) | qrcBitNumIntl(st, 10, 29) | qrcBitNumIntl(st, 3, 30) | qrcBitNumIntl(st, 24, 31)
}

func qrcDesCryptBlock(input []byte, keys qrcRoundKeys) [8]byte {
	s0, s1 := qrcInitialPermutation(input)
	for idx := 0; idx < 15; idx++ {
		prev := s1
		s1 = qrcFeistelF(s1, keys[idx]) ^ s0
		s0 = prev
	}
	s0 = qrcFeistelF(s1, keys[15]) ^ s0
	return qrcInversePermutation(s0, s1)
}

func qrcKeySchedule(key []byte, encrypt bool) qrcRoundKeys {
	var schedule qrcRoundKeys
	var c uint32
	var d uint32
	for i := 0; i < 28; i++ {
		c |= qrcBitNum(key, qrcKeyPermC[i], 31-uint32(i))
		d |= qrcBitNum(key, qrcKeyPermD[i], 31-uint32(i))
	}
	for i := 0; i < 16; i++ {
		shift := qrcKeyRndShift[i]
		c = ((c << shift) | (c >> (28 - shift))) & 0xfffffff0
		d = ((d << shift) | (d >> (28 - shift))) & 0xfffffff0
		target := i
		if !encrypt {
			target = 15 - i
		}
		for j := 0; j < 24; j++ {
			schedule[target][j/8] |= byte(qrcBitNumIntr(c, qrcKeyComp[j], 7-uint32(j%8)))
		}
		for j := 24; j < 48; j++ {
			schedule[target][j/8] |= byte(qrcBitNumIntr(d, qrcKeyComp[j]-27, 7-uint32(j%8)))
		}
	}
	return schedule
}
