//! QQ QRC 自定义 Triple-DES：非标准 S-box + 非标准字节序。
//! 移植自 [LDDC](https://github.com/chenmozhijin/LDDC) `tripledes.py`，
//! 原始参考 [QQMusicDecoder](https://github.com/WXRIW/QQMusicDecoder) C#。

#[rustfmt::skip]
static SBOX: [[u8; 64]; 8] = [
    [14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7,
     0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8,
     4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0,
     15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13],
    [15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10,
     3,13,4,7,15,2,8,15,12,0,1,10,6,9,11,5,
     0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15,
     13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9],
    [10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8,
     13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1,
     13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7,
     1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12],
    [7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15,
     13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9,
     10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4,
     3,15,0,6,10,10,13,8,9,4,5,11,12,7,2,14],
    [2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9,
     14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6,
     4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14,
     11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3],
    [12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11,
     10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8,
     9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6,
     4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13],
    [4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1,
     13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6,
     1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2,
     6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12],
    [13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7,
     1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2,
     7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8,
     2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11],
];

#[inline]
fn bitnum(a: &[u8], b: usize, c: u32) -> u32 {
    let byte_idx = (b / 32) * 4 + 3 - (b % 32) / 8;
    (((a[byte_idx] >> (7 - (b % 8) as u32)) & 1) as u32) << c
}

#[inline]
fn bitnum_intr(a: u32, b: u32, c: u32) -> u32 {
    ((a >> (31 - b)) & 1) << c
}

#[inline]
fn bitnum_intl(a: u32, b: u32, c: u32) -> u32 {
    ((a << b) & 0x8000_0000) >> c
}

#[inline]
fn sbox_bit(a: u32) -> usize {
    ((a & 32) | ((a & 31) >> 1) | ((a & 1) << 4)) as usize
}

fn initial_permutation(d: &[u8]) -> (u32, u32) {
    let s0 =
        bitnum(d,57,31)|bitnum(d,49,30)|bitnum(d,41,29)|bitnum(d,33,28)|
        bitnum(d,25,27)|bitnum(d,17,26)|bitnum(d, 9,25)|bitnum(d, 1,24)|
        bitnum(d,59,23)|bitnum(d,51,22)|bitnum(d,43,21)|bitnum(d,35,20)|
        bitnum(d,27,19)|bitnum(d,19,18)|bitnum(d,11,17)|bitnum(d, 3,16)|
        bitnum(d,61,15)|bitnum(d,53,14)|bitnum(d,45,13)|bitnum(d,37,12)|
        bitnum(d,29,11)|bitnum(d,21,10)|bitnum(d,13, 9)|bitnum(d, 5, 8)|
        bitnum(d,63, 7)|bitnum(d,55, 6)|bitnum(d,47, 5)|bitnum(d,39, 4)|
        bitnum(d,31, 3)|bitnum(d,23, 2)|bitnum(d,15, 1)|bitnum(d, 7, 0);
    let s1 =
        bitnum(d,56,31)|bitnum(d,48,30)|bitnum(d,40,29)|bitnum(d,32,28)|
        bitnum(d,24,27)|bitnum(d,16,26)|bitnum(d, 8,25)|bitnum(d, 0,24)|
        bitnum(d,58,23)|bitnum(d,50,22)|bitnum(d,42,21)|bitnum(d,34,20)|
        bitnum(d,26,19)|bitnum(d,18,18)|bitnum(d,10,17)|bitnum(d, 2,16)|
        bitnum(d,60,15)|bitnum(d,52,14)|bitnum(d,44,13)|bitnum(d,36,12)|
        bitnum(d,28,11)|bitnum(d,20,10)|bitnum(d,12, 9)|bitnum(d, 4, 8)|
        bitnum(d,62, 7)|bitnum(d,54, 6)|bitnum(d,46, 5)|bitnum(d,38, 4)|
        bitnum(d,30, 3)|bitnum(d,22, 2)|bitnum(d,14, 1)|bitnum(d, 6, 0);
    (s0, s1)
}

fn inverse_permutation(s0: u32, s1: u32) -> [u8; 8] {
    let mut d = [0u8; 8];
    d[3] = (bitnum_intr(s1,7,7)|bitnum_intr(s0,7,6)|bitnum_intr(s1,15,5)|bitnum_intr(s0,15,4)|bitnum_intr(s1,23,3)|bitnum_intr(s0,23,2)|bitnum_intr(s1,31,1)|bitnum_intr(s0,31,0)) as u8;
    d[2] = (bitnum_intr(s1,6,7)|bitnum_intr(s0,6,6)|bitnum_intr(s1,14,5)|bitnum_intr(s0,14,4)|bitnum_intr(s1,22,3)|bitnum_intr(s0,22,2)|bitnum_intr(s1,30,1)|bitnum_intr(s0,30,0)) as u8;
    d[1] = (bitnum_intr(s1,5,7)|bitnum_intr(s0,5,6)|bitnum_intr(s1,13,5)|bitnum_intr(s0,13,4)|bitnum_intr(s1,21,3)|bitnum_intr(s0,21,2)|bitnum_intr(s1,29,1)|bitnum_intr(s0,29,0)) as u8;
    d[0] = (bitnum_intr(s1,4,7)|bitnum_intr(s0,4,6)|bitnum_intr(s1,12,5)|bitnum_intr(s0,12,4)|bitnum_intr(s1,20,3)|bitnum_intr(s0,20,2)|bitnum_intr(s1,28,1)|bitnum_intr(s0,28,0)) as u8;
    d[7] = (bitnum_intr(s1,3,7)|bitnum_intr(s0,3,6)|bitnum_intr(s1,11,5)|bitnum_intr(s0,11,4)|bitnum_intr(s1,19,3)|bitnum_intr(s0,19,2)|bitnum_intr(s1,27,1)|bitnum_intr(s0,27,0)) as u8;
    d[6] = (bitnum_intr(s1,2,7)|bitnum_intr(s0,2,6)|bitnum_intr(s1,10,5)|bitnum_intr(s0,10,4)|bitnum_intr(s1,18,3)|bitnum_intr(s0,18,2)|bitnum_intr(s1,26,1)|bitnum_intr(s0,26,0)) as u8;
    d[5] = (bitnum_intr(s1,1,7)|bitnum_intr(s0,1,6)|bitnum_intr(s1, 9,5)|bitnum_intr(s0, 9,4)|bitnum_intr(s1,17,3)|bitnum_intr(s0,17,2)|bitnum_intr(s1,25,1)|bitnum_intr(s0,25,0)) as u8;
    d[4] = (bitnum_intr(s1,0,7)|bitnum_intr(s0,0,6)|bitnum_intr(s1, 8,5)|bitnum_intr(s0, 8,4)|bitnum_intr(s1,16,3)|bitnum_intr(s0,16,2)|bitnum_intr(s1,24,1)|bitnum_intr(s0,24,0)) as u8;
    d
}

fn feistel_f(state: u32, key: &[u8; 6]) -> u32 {
    let t1 =
        bitnum_intl(state,31,0) | ((state & 0xf000_0000) >> 1) | bitnum_intl(state,4,5) |
        bitnum_intl(state, 3,6) | ((state & 0x0f00_0000) >> 3) | bitnum_intl(state,8,11) |
        bitnum_intl(state, 7,12)| ((state & 0x00f0_0000) >> 5) | bitnum_intl(state,12,17)|
        bitnum_intl(state,11,18)| ((state & 0x000f_0000) >> 7) | bitnum_intl(state,16,23);
    let t2 =
        bitnum_intl(state,15,0) | ((state & 0x0000_f000) << 15)| bitnum_intl(state,20,5) |
        bitnum_intl(state,19,6) | ((state & 0x0000_0f00) << 13)| bitnum_intl(state,24,11)|
        bitnum_intl(state,23,12)| ((state & 0x0000_00f0) << 11)| bitnum_intl(state,28,17)|
        bitnum_intl(state,27,18)| ((state & 0x0000_000f) <<  9)| bitnum_intl(state, 0,23);

    let lg: [u8; 6] = [
        ((t1 >> 24) as u8) ^ key[0],
        ((t1 >> 16) as u8) ^ key[1],
        ((t1 >>  8) as u8) ^ key[2],
        ((t2 >> 24) as u8) ^ key[3],
        ((t2 >> 16) as u8) ^ key[4],
        ((t2 >>  8) as u8) ^ key[5],
    ];

    let st: u32 =
        (SBOX[0][sbox_bit((lg[0] >> 2) as u32)] as u32) << 28 |
        (SBOX[1][sbox_bit((((lg[0] & 0x03) << 4) | (lg[1] >> 4)) as u32)] as u32) << 24 |
        (SBOX[2][sbox_bit((((lg[1] & 0x0f) << 2) | (lg[2] >> 6)) as u32)] as u32) << 20 |
        (SBOX[3][sbox_bit((lg[2] & 0x3f) as u32)] as u32) << 16 |
        (SBOX[4][sbox_bit((lg[3] >> 2) as u32)] as u32) << 12 |
        (SBOX[5][sbox_bit((((lg[3] & 0x03) << 4) | (lg[4] >> 4)) as u32)] as u32) <<  8 |
        (SBOX[6][sbox_bit((((lg[4] & 0x0f) << 2) | (lg[5] >> 6)) as u32)] as u32) <<  4 |
        (SBOX[7][sbox_bit((lg[5] & 0x3f) as u32)] as u32);

    bitnum_intl(st,15,0)|bitnum_intl(st,6,1)|bitnum_intl(st,19,2)|bitnum_intl(st,20,3)|
    bitnum_intl(st,28,4)|bitnum_intl(st,11,5)|bitnum_intl(st,27,6)|bitnum_intl(st,16,7)|
    bitnum_intl(st,0,8)|bitnum_intl(st,14,9)|bitnum_intl(st,22,10)|bitnum_intl(st,25,11)|
    bitnum_intl(st,4,12)|bitnum_intl(st,17,13)|bitnum_intl(st,30,14)|bitnum_intl(st,9,15)|
    bitnum_intl(st,1,16)|bitnum_intl(st,7,17)|bitnum_intl(st,23,18)|bitnum_intl(st,13,19)|
    bitnum_intl(st,31,20)|bitnum_intl(st,26,21)|bitnum_intl(st,2,22)|bitnum_intl(st,8,23)|
    bitnum_intl(st,18,24)|bitnum_intl(st,12,25)|bitnum_intl(st,29,26)|bitnum_intl(st,5,27)|
    bitnum_intl(st,21,28)|bitnum_intl(st,10,29)|bitnum_intl(st,3,30)|bitnum_intl(st,24,31)
}

type RoundKeys = [[u8; 6]; 16];

fn des_crypt_block(input: &[u8], keys: &RoundKeys) -> [u8; 8] {
    let (mut s0, mut s1) = initial_permutation(input);
    for idx in 0..15 {
        let prev = s1;
        s1 = feistel_f(s1, &keys[idx]) ^ s0;
        s0 = prev;
    }
    s0 = feistel_f(s1, &keys[15]) ^ s0;
    inverse_permutation(s0, s1)
}

static KEY_RND_SHIFT: [u32; 16] = [1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1];
#[rustfmt::skip]
static KEY_PERM_C: [usize; 28] = [56,48,40,32,24,16,8,0,57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35];
#[rustfmt::skip]
static KEY_PERM_D: [usize; 28] = [62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,60,52,44,36,28,20,12,4,27,19,11,3];
#[rustfmt::skip]
static KEY_COMP: [u32; 48] = [13,16,10,23,0,4,2,27,14,5,20,9,22,18,11,3,25,7,15,6,26,19,12,1,40,51,30,36,46,54,29,39,50,44,32,47,43,48,38,55,33,52,45,41,49,35,28,31];

const DECRYPT: bool = false;
const ENCRYPT: bool = true;

fn key_schedule(key: &[u8], encrypt: bool) -> RoundKeys {
    let mut schedule = [[0u8; 6]; 16];
    let mut c: u32 = (0..28).map(|i| bitnum(key, KEY_PERM_C[i], 31 - i as u32)).sum();
    let mut d: u32 = (0..28).map(|i| bitnum(key, KEY_PERM_D[i], 31 - i as u32)).sum();

    for i in 0..16usize {
        let shift = KEY_RND_SHIFT[i];
        c = ((c << shift) | (c >> (28 - shift))) & 0xffff_fff0;
        d = ((d << shift) | (d >> (28 - shift))) & 0xffff_fff0;
        let tgt = if encrypt { i } else { 15 - i };
        schedule[tgt] = [0; 6];
        for j in 0..24usize {
            schedule[tgt][j / 8] |= bitnum_intr(c, KEY_COMP[j], 7 - (j as u32 % 8)) as u8;
        }
        for j in 24..48usize {
            schedule[tgt][j / 8] |= bitnum_intr(d, KEY_COMP[j] - 27, 7 - (j as u32 % 8)) as u8;
        }
    }
    schedule
}

pub struct QrcTripleDes {
    keys: [RoundKeys; 3],
}

impl QrcTripleDes {
    pub fn new_decrypt(key: &[u8; 24]) -> Self {
        Self {
            keys: [
                key_schedule(&key[16..], DECRYPT),
                key_schedule(&key[8..],  ENCRYPT),
                key_schedule(&key[..],   DECRYPT),
            ],
        }
    }

    pub fn decrypt_block(&self, block: &[u8]) -> [u8; 8] {
        let mut buf = des_crypt_block(block, &self.keys[0]);
        buf = des_crypt_block(&buf, &self.keys[1]);
        des_crypt_block(&buf, &self.keys[2])
    }
}
