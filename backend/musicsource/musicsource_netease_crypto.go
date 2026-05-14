package musicsource

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"math/big"
	"strings"
)

// Netease WEAPI crypto mirrors web behavior: double AES-CBC plus RSA(no-padding) for encSecKey.
const (
	neteasePresetKey = "0CoJUm6Qyw8W8jud"
	neteaseIV        = "0102030405060708"
	neteaseBase62    = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	neteasePublicKey = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB
-----END PUBLIC KEY-----`
)

func neteaseWEAPIForm(payload any) (map[string]string, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	secret, err := neteaseRandomKey(16)
	if err != nil {
		return nil, err
	}
	first, err := neteaseAESEncryptCBC(string(body), neteasePresetKey, neteaseIV)
	if err != nil {
		return nil, err
	}
	second, err := neteaseAESEncryptCBC(first, secret, neteaseIV)
	if err != nil {
		return nil, err
	}
	encSecKey, err := neteaseRSAEncryptNoPaddingHex(neteaseReverse(secret), neteasePublicKey)
	if err != nil {
		return nil, err
	}
	return map[string]string{
		"params":    second,
		"encSecKey": encSecKey,
	}, nil
}

func neteaseRandomKey(length int) (string, error) {
	if length <= 0 {
		return "", fmt.Errorf("invalid random key length")
	}
	buffer := make([]byte, length)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	chars := make([]byte, length)
	for index := 0; index < length; index++ {
		chars[index] = neteaseBase62[int(buffer[index])%len(neteaseBase62)]
	}
	return string(chars), nil
}

func neteaseAESEncryptCBC(text, key, iv string) (string, error) {
	block, err := aes.NewCipher([]byte(key))
	if err != nil {
		return "", err
	}
	padded := neteasePKCS7Pad([]byte(text), block.BlockSize())
	cipherText := make([]byte, len(padded))
	mode := cipher.NewCBCEncrypter(block, []byte(iv))
	mode.CryptBlocks(cipherText, padded)
	return base64.StdEncoding.EncodeToString(cipherText), nil
}

func neteasePKCS7Pad(data []byte, blockSize int) []byte {
	padding := blockSize - (len(data) % blockSize)
	if padding == 0 {
		padding = blockSize
	}
	return append(data, bytes.Repeat([]byte{byte(padding)}, padding)...)
}

func neteaseRSAEncryptNoPaddingHex(text, pemPublicKey string) (string, error) {
	block, _ := pem.Decode([]byte(pemPublicKey))
	if block == nil {
		return "", fmt.Errorf("failed to parse public key")
	}
	pubAny, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return "", err
	}
	pub, ok := pubAny.(*rsa.PublicKey)
	if !ok {
		return "", fmt.Errorf("invalid rsa public key")
	}
	value := new(big.Int).SetBytes([]byte(text))
	encrypted := value.Exp(value, big.NewInt(int64(pub.E)), pub.N).Bytes()
	hexValue := hex.EncodeToString(encrypted)
	keyLen := pub.Size() * 2
	if len(hexValue) < keyLen {
		hexValue = strings.Repeat("0", keyLen-len(hexValue)) + hexValue
	}
	return hexValue, nil
}

func neteaseReverse(value string) string {
	runes := []rune(value)
	for left, right := 0, len(runes)-1; left < right; left, right = left+1, right-1 {
		runes[left], runes[right] = runes[right], runes[left]
	}
	return string(runes)
}
