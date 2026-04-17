fn main() {
    tauri_build::build();
    // Android 15+ 设备可能使用 16KB 内存页；未按 16KB 对齐的原生库会触发系统「未适配」类提示或无法运行。
    // 参见：https://developer.android.com/guide/practices/page-sizes
    let target = std::env::var("TARGET").unwrap_or_default();
    if target.ends_with("-linux-android") {
        println!("cargo:rustc-link-arg=-Wl,-z,max-page-size=16384");
    }
}
