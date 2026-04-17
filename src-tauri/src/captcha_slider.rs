//! tianai-captcha 滑块求解：
//!
//! 站点返回的 `templateImage` 是与背景**同高**的 RGBA PNG，只有**非透明区域**是真正的滑块拼块；
//! 直接把整张 PNG 当模板在背景里匹配会被透明边缘/padding 主导。正确做法：
//!
//! 1. 以 RGBA 解码模板，按 `alpha > 0` 找出非透明包围盒，裁出**小的纯滑块图**；
//! 2. `imageproc::match_template` 要求模板在宽高上**严格小于**背景，必要时对背景 `pad` 一圈；
//! 3. Canny + 归一化互相关 + 若干兜底策略在列方向取最大，得到背景中拼块的 x（`bg_match_x`）；
//! 4. 返回**用户拖动距离** = `bg_match_x - template_inner_x`（tianai 校验期望这个 x）。

use base64::Engine;
use image::{GrayImage, RgbaImage};
use imageproc::edges::canny;
use imageproc::template_matching::{match_template, MatchTemplateMethod};

fn strip_data_url(b64: &str) -> &str {
    let s = b64.trim();
    if let Some(i) = s.find(',') {
        if s[..i].contains("base64") {
            return s[i + 1..].trim();
        }
    }
    s
}

fn decode_bytes_b64_loose(raw: &str) -> Option<Vec<u8>> {
    let t = raw.trim();
    use base64::engine::general_purpose;
    general_purpose::STANDARD
        .decode(t.as_bytes())
        .or_else(|_| general_purpose::URL_SAFE.decode(t.as_bytes()))
        .or_else(|_| general_purpose::URL_SAFE_NO_PAD.decode(t.as_bytes()))
        .ok()
}

fn decode_luma_b64_loose(b64: &str) -> Option<GrayImage> {
    let raw = strip_data_url(b64);
    let bytes = decode_bytes_b64_loose(raw)?;
    let img = image::load_from_memory(&bytes).ok()?.to_luma8();
    Some(img)
}

fn decode_rgba_b64_loose(b64: &str) -> Option<RgbaImage> {
    let raw = strip_data_url(b64);
    let bytes = decode_bytes_b64_loose(raw)?;
    let img = image::load_from_memory(&bytes).ok()?.to_rgba8();
    Some(img)
}

/// 按 `alpha > threshold` 的像素计算包围盒，返回 `(x0, y0, w, h)`；无非透明像素则 `None`。
fn alpha_bbox(img: &RgbaImage, threshold: u8) -> Option<(u32, u32, u32, u32)> {
    let (w, h) = img.dimensions();
    let mut min_x = u32::MAX;
    let mut min_y = u32::MAX;
    let mut max_x = 0u32;
    let mut max_y = 0u32;
    let mut found = false;
    for y in 0..h {
        for x in 0..w {
            let a = img.get_pixel(x, y).0[3];
            if a > threshold {
                found = true;
                if x < min_x {
                    min_x = x;
                }
                if y < min_y {
                    min_y = y;
                }
                if x > max_x {
                    max_x = x;
                }
                if y > max_y {
                    max_y = y;
                }
            }
        }
    }
    if !found {
        return None;
    }
    Some((min_x, min_y, max_x - min_x + 1, max_y - min_y + 1))
}

/// 把 RGBA 模板裁到非透明包围盒并转灰度；返回 `(crop_luma, inner_x)`，`inner_x` 为裁出区在原模板内的左偏移。
fn crop_template_to_content(rgba: &RgbaImage) -> Option<(GrayImage, u32)> {
    // 先试严格 alpha>0，失败再放宽一点：某些 PNG 导出带轻微边缘 alpha。
    let (x0, y0, cw, ch) =
        alpha_bbox(rgba, 0).or_else(|| alpha_bbox(rgba, 12))?;
    if cw < 4 || ch < 4 {
        return None;
    }
    let mut crop = GrayImage::new(cw, ch);
    for y in 0..ch {
        for x in 0..cw {
            let p = rgba.get_pixel(x0 + x, y0 + y).0;
            // 加权灰度（与 image 的 to_luma8 一致）
            let r = p[0] as f32 * 0.299;
            let g = p[1] as f32 * 0.587;
            let b = p[2] as f32 * 0.114;
            let v = (r + g + b).round().clamp(0.0, 255.0) as u8;
            crop.put_pixel(x, y, image::Luma([v]));
        }
    }
    Some((crop, x0))
}

/// 滑块只水平移动：在相关图中优先看「垂直中部」带状区域，减少上下噪声峰抢 x。
fn y_band(map_h: u32, margin_frac: f32) -> (u32, u32) {
    if map_h <= 1 {
        return (0, map_h.saturating_sub(1));
    }
    let max_m = (map_h - 1) / 2;
    let m = (((map_h as f32) * margin_frac).floor() as u32).min(max_m);
    let y0 = m;
    let y1 = map_h - 1 - m;
    (y0, y1.max(y0))
}

fn best_max_horizontal(
    map: &image::ImageBuffer<image::Luma<f32>, Vec<f32>>,
    margin_frac: f32,
) -> (f32, u32) {
    let (w, h) = map.dimensions();
    if w == 0 || h == 0 {
        return (0.0, 0);
    }
    let (y0, y1) = y_band(h, margin_frac);
    let mut best = 0.0f32;
    let mut best_x = 0u32;
    for x in 0..w {
        let mut col = 0.0f32;
        for y in y0..=y1 {
            let v = map.get_pixel(x, y).0[0];
            if v > col {
                col = v;
            }
        }
        if col > best {
            best = col;
            best_x = x;
        }
    }
    (best, best_x)
}

fn best_min_horizontal(
    map: &image::ImageBuffer<image::Luma<f32>, Vec<f32>>,
    margin_frac: f32,
) -> (f32, u32) {
    let (w, h) = map.dimensions();
    if w == 0 || h == 0 {
        return (f32::MAX, 0);
    }
    let (y0, y1) = y_band(h, margin_frac);
    let mut best = f32::MAX;
    let mut best_x = 0u32;
    for x in 0..w {
        let mut col = f32::MAX;
        for y in y0..=y1 {
            let v = map.get_pixel(x, y).0[0];
            if v < col {
                col = v;
            }
        }
        if col < best {
            best = col;
            best_x = x;
        }
    }
    (best, best_x)
}

fn template_fits(bg: &GrayImage, fg: &GrayImage) -> bool {
    bg.width() > fg.width() && bg.height() > fg.height()
}

/// `imageproc::match_template` 要求模板宽高严格小于背景；对背景边缘 1px 复制扩展以满足该约束。
fn pad_until_template_fits(large: &GrayImage, small: &GrayImage) -> GrayImage {
    let mut bg = large.clone();
    while bg.width() <= small.width() {
        let (w, h) = bg.dimensions();
        let mut out = GrayImage::new(w + 1, h);
        for y in 0..h {
            for x in 0..w {
                out.put_pixel(x, y, *bg.get_pixel(x, y));
            }
            out.put_pixel(w, y, *bg.get_pixel(w - 1, y));
        }
        bg = out;
    }
    while bg.height() <= small.height() {
        let (w, h) = bg.dimensions();
        let mut out = GrayImage::new(w, h + 1);
        for y in 0..h {
            for x in 0..w {
                out.put_pixel(x, y, *bg.get_pixel(x, y));
            }
        }
        for x in 0..w {
            out.put_pixel(x, h, *bg.get_pixel(x, h - 1));
        }
        bg = out;
    }
    bg
}

fn clamp_x(large_w: u32, small_w: u32, x: i32) -> i32 {
    let max_x = large_w.saturating_sub(small_w) as i32;
    x.max(0).min(max_x)
}

fn try_canny(bg: &GrayImage, fg: &GrayImage, low: f32, high: f32) -> Option<(i32, f32)> {
    if !template_fits(bg, fg) {
        return None;
    }
    let bg_e = canny(bg, low, high);
    let fg_e = canny(fg, low, high);
    let map = match_template(&bg_e, &fg_e, MatchTemplateMethod::CrossCorrelationNormalized);
    let (best, best_x) = best_max_horizontal(&map, 0.22);
    if !best.is_finite() {
        return None;
    }
    Some((best_x as i32, best))
}

fn try_raw_ncc(bg: &GrayImage, fg: &GrayImage) -> Option<(i32, f32)> {
    if !template_fits(bg, fg) {
        return None;
    }
    let map = match_template(bg, fg, MatchTemplateMethod::CrossCorrelationNormalized);
    let (best, best_x) = best_max_horizontal(&map, 0.22);
    if !best.is_finite() {
        return None;
    }
    Some((best_x as i32, best))
}

fn try_sse_norm(bg: &GrayImage, fg: &GrayImage) -> Option<(i32, f32)> {
    if !template_fits(bg, fg) {
        return None;
    }
    let map = match_template(bg, fg, MatchTemplateMethod::SumOfSquaredErrorsNormalized);
    let (best, best_x) = best_min_horizontal(&map, 0.22);
    if !best.is_finite() {
        return None;
    }
    Some((best_x as i32, best))
}

/// 在背景中匹配裁剪后的小模板，返回背景中的 x（`bg_match_x`）与置信度。
fn match_in_bg(bg_raw: &GrayImage, tmpl: &GrayImage) -> Option<i32> {
    let padded = pad_until_template_fits(bg_raw, tmpl);
    let bg = &padded;
    let orig_w = bg_raw.width();

    const CANNY_PRESETS: &[(f32, f32, f32)] = &[
        (100.0, 200.0, 0.19),
        (50.0, 150.0, 0.14),
        (80.0, 180.0, 0.12),
        (35.0, 110.0, 0.10),
        (20.0, 80.0, 0.085),
        (15.0, 60.0, 0.075),
        (10.0, 50.0, 0.065),
    ];

    let mut best_score = 0.0f32;
    let mut best_x: Option<i32> = None;
    for &(lo, hi, min_c) in CANNY_PRESETS {
        if let Some((x, sc)) = try_canny(bg, tmpl, lo, hi) {
            if sc >= min_c && sc > best_score {
                best_score = sc;
                best_x = Some(x);
            }
        }
    }
    if let Some(x) = best_x {
        return Some(clamp_x(orig_w, tmpl.width(), x));
    }

    if let Some((x, sc)) = try_raw_ncc(bg, tmpl) {
        if sc >= 0.03 {
            return Some(clamp_x(orig_w, tmpl.width(), x));
        }
    }

    if let Some((x, v)) = try_sse_norm(bg, tmpl) {
        if v < 0.60 {
            return Some(clamp_x(orig_w, tmpl.width(), x));
        }
    }

    None
}

/// tianai-captcha 求解入口：
/// - `background_b64`：`captcha.backgroundImage`（JPEG）；
/// - `template_b64`：`captcha.templateImage`（同尺寸 RGBA PNG，非透明区为拼块）。
///
/// 返回 `Some(drag_x)`，`drag_x` 即需写入 `trackList` 最末 `x` 与 `stopTime - startTime` 结束位的 x。
pub fn solve_tianai_slider(background_b64: &str, template_b64: &str) -> Option<i32> {
    let bg = decode_luma_b64_loose(background_b64)?;
    let tmpl_rgba = decode_rgba_b64_loose(template_b64)?;

    if let Some((crop, inner_x)) = crop_template_to_content(&tmpl_rgba) {
        if let Some(bg_x) = match_in_bg(&bg, &crop) {
            let drag = bg_x - inner_x as i32;
            return Some(drag.max(0));
        }
    }

    // 兜底：若没法按 alpha 裁（例如不是 RGBA），直接整图匹配并返回匹配到的 x。
    let tmpl_luma = decode_luma_b64_loose(template_b64)?;
    match_in_bg(&bg, &tmpl_luma)
}
