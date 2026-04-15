import { Dialogs } from "@wailsio/runtime";

export async function open(options = {}) {
  const result = await Dialogs.OpenFile({
    Title: options.title || "",
    DefaultDirectory: options.defaultPath || "",
    AllowsMultipleSelection: !!options.multiple,
    CanChooseDirectories: !!options.directory,
    CanChooseFiles: !options.directory,
    CanCreateDirectories: true,
  });
  if (Array.isArray(result)) {
    return result;
  }
  return result || null;
}
