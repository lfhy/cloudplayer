// Error helpers keep the user-facing message policy consistent across modules.
export const MSG_REQUEST_FAILED = "请求失败";

export function warnRequestFailed(error, label) {
  if (label) console.warn(label, error);
  else console.warn(error);
}

export function alertRequestFailed(error, label) {
  warnRequestFailed(error, label);
  alert(MSG_REQUEST_FAILED);
}
