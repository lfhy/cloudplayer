package main

/*
#include <stdlib.h>
*/
import "C"

import (
	"encoding/json"
	"strings"
	"unsafe"
)

// C exports keep the Flutter FFI surface limited to invoke/free operations.
func main() {}

//export CloudPlayerInvoke
func CloudPlayerInvoke(method *C.char, args *C.char) *C.char {
	methodName := ""
	if method != nil {
		methodName = strings.TrimSpace(C.GoString(method))
	}
	rawArgs := ""
	if args != nil {
		rawArgs = C.GoString(args)
	}
	result, err := invokeBridgeMethod(methodName, json.RawMessage(rawArgs))
	if err != nil {
		return C.CString(buildErrorPayload(err))
	}
	return C.CString(buildSuccessPayload(result))
}

//export CloudPlayerFreeString
func CloudPlayerFreeString(value *C.char) {
	if value == nil {
		return
	}
	C.free(unsafe.Pointer(value))
}
