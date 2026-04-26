//! 与 Python `services/download_service.py` 对齐：顺序队列、captcha 链、流式落盘。

use std::error::Error;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use futures_util::StreamExt;
use log::{error, info, warn};
use rand::Rng;
use reqwest::Client;
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::AsyncWriteExt;

use crate::captcha_slider::solve_tianai_slider;
use crate::config::{default_download_dir, Settings, BASE_URL};

const BROWSER_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

fn persist_downloaded_record(app: &AppHandle, path: &Path, job: &DownloadJob, written_len: u64) {
    let Some(state) = app.try_state::<crate::db::DbState>() else {
        warn!(target: "download", "DbState missing, skip downloaded_tracks insert");
        return;
    };
    let file_size = std::fs::metadata(path)
        .map(|m| m.len() as i64)
        .unwrap_or(written_len as i64);
    let (duration_ms, album_tag) = crate::download_meta::probe_audio_file(path);
    let path_str = path.to_string_lossy().to_string();
    let completed_at = chrono::Utc::now().timestamp_millis();
    let conn = match state.conn.lock() {
        Ok(c) => c,
        Err(e) => {
            warn!(target: "download", "db lock: {}", e);
            return;
        }
    };
    if let Err(e) = crate::db::insert_downloaded_track(
        &conn,
        &path_str,
        job.title.trim(),
        job.artist.trim(),
        album_tag.trim(),
        duration_ms,
        file_size,
        job.source_id.trim(),
        job.quality.trim(),
        completed_at,
    ) {
        warn!(target: "download", "insert downloaded_tracks: {}", e);
    }
}

/// 把 `reqwest` 的根因（TLS/DNS/连接等）拼进文案，便于与「站点业务错误」区分。
fn format_reqwest_err(e: &reqwest::Error) -> String {
    let mut parts: Vec<String> = vec![e.to_string()];
    let mut cur: Option<&dyn Error> = e.source();
    while let Some(c) = cur {
        parts.push(c.to_string());
        cur = c.source();
    }
    let detail = parts.join(" | ");
    let hint = if e.is_timeout() {
        "（请求超时：可检查网络、代理或稍后重试）"
    } else if e.is_connect() {
        "（无法连接服务器：DNS、防火墙、代理或目标站点不可达）"
    } else if e.is_request() {
        "（请求构建或发送阶段失败）"
    } else {
        ""
    };
    if hint.is_empty() {
        detail
    } else {
        format!("{detail}{hint}")
    }
}

async fn get_captcha_gen_with_retry(client: &Client, base: &str) -> Result<reqwest::Response, reqwest::Error> {
    let url = format!("{}/captcha/gen", base);
    let mut last_err: Option<reqwest::Error> = None;
    for attempt in 1..=3u32 {
        match client
            .get(&url)
            .header("User-Agent", BROWSER_UA)
            .header("Referer", format!("{}/", base))
            .header("Accept", "application/json, text/plain, */*")
            .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
            .send()
            .await
        {
            Ok(r) => return Ok(r),
            Err(e) => {
                if attempt < 3 {
                    warn!(
                        target: "download",
                        "captcha/gen 第 {} 次请求失败: {}",
                        attempt,
                        format_reqwest_err(&e)
                    );
                    tokio::time::sleep(Duration::from_millis(400 * attempt as u64)).await;
                }
                last_err = Some(e);
            }
        }
    }
    Err(last_err.expect("retry loop"))
}

#[derive(Debug, Clone)]
pub struct DownloadJob {
    pub source_id: String,
    pub title: String,
    pub artist: String,
    pub quality: String,
}

#[derive(Clone, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DownloadTaskEvent {
    pub source_id: String,
    pub title: String,
    pub artist: String,
    pub quality: String,
    pub status: String,
    pub progress: f64,
    pub message: Option<String>,
}

fn emit_download_step(
    task: &mut DownloadTaskEvent,
    emit: &impl Fn(DownloadTaskEvent),
    progress: f64,
    msg: impl Into<String>,
) {
    task.progress = progress.clamp(0.0, 1.0);
    task.message = Some(msg.into());
    emit(task.clone());
}

fn sanitize_filename(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect()
}

/// tianai-captcha `/captcha/gen` 相关字段的提取。
#[derive(Debug, Clone)]
struct TianaiCaptcha {
    id: String,
    background_b64: String,
    template_b64: String,
    bg_w: u32,
    bg_h: u32,
    tmpl_w: u32,
    tmpl_h: u32,
}

fn u32_from_value(v: Option<&Value>) -> Option<u32> {
    v.and_then(|x| x.as_u64()).and_then(|n| u32::try_from(n).ok())
}

/// 从 `/captcha/gen` JSON 里按 tianai-captcha 字段抽取；
/// 兼容 `{id, captcha:{backgroundImage,templateImage,...}}` 与顶层平铺两种结构。
fn extract_tianai_captcha(v: &Value) -> Option<TianaiCaptcha> {
    fn try_obj(id: &str, m: &serde_json::Map<String, Value>) -> Option<TianaiCaptcha> {
        let bg = m.get("backgroundImage")?.as_str()?.to_string();
        let tmpl = m.get("templateImage")?.as_str()?.to_string();
        let bg_w = u32_from_value(m.get("backgroundImageWidth")).unwrap_or(0);
        let bg_h = u32_from_value(m.get("backgroundImageHeight")).unwrap_or(0);
        let tmpl_w = u32_from_value(m.get("templateImageWidth")).unwrap_or(0);
        let tmpl_h = u32_from_value(m.get("templateImageHeight")).unwrap_or(0);
        if bg.len() < 200 || tmpl.len() < 100 {
            return None;
        }
        Some(TianaiCaptcha {
            id: id.to_string(),
            background_b64: bg,
            template_b64: tmpl,
            bg_w,
            bg_h,
            tmpl_w,
            tmpl_h,
        })
    }

    let m = v.as_object()?;
    let id = m.get("id").and_then(|x| x.as_str()).unwrap_or("");
    if id.len() >= 8 {
        if let Some(Value::Object(inner)) = m.get("captcha") {
            if let Some(c) = try_obj(id, inner) {
                return Some(c);
            }
        }
        if let Some(c) = try_obj(id, m) {
            return Some(c);
        }
    }
    None
}

fn dest_root() -> PathBuf {
    let s = Settings::load();
    let p = s.download_folder.trim();
    if p.is_empty() {
        default_download_dir()
    } else {
        PathBuf::from(p)
    }
}

/// 与 `run_one_job` 落盘规则一致：`{title} - {artist}.mp3` / `.flac`，用于播放时优先走已下载文件。
pub fn candidate_downloaded_audio_paths(title: &str, artist: &str) -> Vec<PathBuf> {
    let root = dest_root();
    let name_mp3 = sanitize_filename(&format!("{} - {}.mp3", title.trim(), artist.trim()));
    let name_flac = sanitize_filename(&format!("{} - {}.flac", title.trim(), artist.trim()));
    vec![root.join(name_mp3), root.join(name_flac)]
}

fn check_and_reserve_download_slot() -> Result<(), String> {
    let mut s = Settings::load();
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    if s.downloads_today_date != today {
        s.downloads_today_date = today;
        s.downloads_today_count = 0;
    }
    if s.daily_download_limit > 0 && s.downloads_today_count >= s.daily_download_limit {
        return Err(format!(
            "已达到当日下载上限（{} 次）",
            s.daily_download_limit
        ));
    }
    Ok(())
}

fn download_fail_emit(
    task: &mut DownloadTaskEvent,
    emit: &impl Fn(DownloadTaskEvent),
    job: &DownloadJob,
    msg: String,
) {
    error!(
        target: "download",
        "{} | source_id={} title={} artist={}",
        msg,
        job.source_id,
        job.title,
        job.artist
    );
    task.status = "failed".to_string();
    task.message = Some(msg);
    emit(task.clone());
}

fn record_download_success() -> Result<(), String> {
    let mut s = Settings::load();
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    if s.downloads_today_date != today {
        s.downloads_today_date = today;
        s.downloads_today_count = 0;
    }
    s.downloads_today_count += 1;
    s.save()
}

pub async fn run_one_job(client: Client, app: AppHandle, job: DownloadJob) {
    let emit = |task: DownloadTaskEvent| {
        let _ = app.emit("download-task-changed", &task);
    };

    let mut task = DownloadTaskEvent {
        source_id: job.source_id.clone(),
        title: job.title.clone(),
        artist: job.artist.clone(),
        quality: job.quality.clone(),
        status: "queued".to_string(),
        progress: 0.0,
        message: None,
    };

    if let Err(e) = check_and_reserve_download_slot() {
        download_fail_emit(&mut task, &emit, &job, e);
        return;
    }

    task.status = "downloading".to_string();
    emit(task.clone());
    emit_download_step(&mut task, &emit, 0.04, "准备下载（验证码）…");

    let base = BASE_URL.trim_end_matches('/');
    let song_page = format!("{}/song.php?id={}", base, job.source_id);

    // tianai-captcha TTL 很短且每个 id 只能校验一次；遇到 `已失效`/`基础校验失败` 时重新 gen。
    const CAPTCHA_MAX_ATTEMPTS: usize = 4;
    let mut captcha_id = String::new();
    let mut last_fail_msg: Option<String> = None;

    for attempt in 1..=CAPTCHA_MAX_ATTEMPTS {
        emit_download_step(
            &mut task,
            &emit,
            0.06 + (attempt.saturating_sub(1)) as f64 * 0.06,
            format!("验证码 {attempt}/{max}：拉取图片…", max = CAPTCHA_MAX_ATTEMPTS),
        );
        let gen_r = match get_captcha_gen_with_retry(&client, base).await {
            Ok(r) => r,
            Err(e) => {
                last_fail_msg = Some(format!("captcha/gen: {}", format_reqwest_err(&e)));
                continue;
            }
        };
        if !gen_r.status().is_success() {
            last_fail_msg = Some(format!("captcha/gen HTTP {}", gen_r.status()));
            continue;
        }
        let gen_text = match gen_r.text().await {
            Ok(t) => t,
            Err(e) => {
                last_fail_msg =
                    Some(format!("读取验证码响应: {}", format_reqwest_err(&e)));
                continue;
            }
        };
        let payload: Value = match serde_json::from_str(&gen_text) {
            Ok(v) => v,
            Err(e) => {
                last_fail_msg = Some(format!("验证码响应非 JSON: {e}"));
                continue;
            }
        };
        let Some(cap) = extract_tianai_captcha(&payload) else {
            let prefix: String = gen_text.chars().take(500).collect();
            warn!(
                target: "download",
                "captcha/gen: tianai 字段缺失 | body prefix: {}",
                prefix
            );
            last_fail_msg = Some("无法解析验证码响应结构".to_string());
            continue;
        };

        emit_download_step(
            &mut task,
            &emit,
            0.12 + (attempt.saturating_sub(1)) as f64 * 0.06,
            "识别滑块位置（计算中，请稍候）…",
        );
        let drag_x = match solve_tianai_slider(&cap.background_b64, &cap.template_b64) {
            Some(v) => v,
            None => {
                last_fail_msg = Some("自动滑块匹配失败".to_string());
                continue;
            }
        };

        emit_download_step(
            &mut task,
            &emit,
            0.22 + (attempt.saturating_sub(1)) as f64 * 0.05,
            "提交验证…",
        );
        // tianai-captcha `/captcha/check`：POST JSON，需要 bg/tmpl 尺寸 + trackList。
        let start = chrono::Local::now();
        // 模拟 1.1~1.8s 的拖动过程；与后端"轨迹熵"校验相容。
        let drag_duration_ms: u64 = {
            let mut rng = rand::thread_rng();
            rng.gen_range(1100u64..1800u64)
        };
        let stop = start + chrono::Duration::milliseconds(drag_duration_ms as i64);
        let fmt =
            |t: chrono::DateTime<chrono::Local>| t.format("%Y-%m-%d %H:%M:%S").to_string();

        // 用 3 个关键点构造一条单调上升的拖动轨迹（down → 中段 move → up）。
        let mid_x = (drag_x as f64 * 0.55).round() as i32;
        let mid_t = (drag_duration_ms as f64 * 0.5).round() as i64;
        let end_t = drag_duration_ms as i64;
        let track = serde_json::json!([
            {"x": 0, "y": 0, "type": "down", "t": 0},
            {"x": mid_x, "y": 4, "type": "move", "t": mid_t},
            {"x": drag_x, "y": 6, "type": "move", "t": end_t - 50},
            {"x": drag_x, "y": 6, "type": "up", "t": end_t},
        ]);

        let (bg_w, bg_h) = if cap.bg_w > 0 && cap.bg_h > 0 {
            (cap.bg_w, cap.bg_h)
        } else {
            (600, 300)
        };
        let (tmpl_w, tmpl_h) = if cap.tmpl_w > 0 && cap.tmpl_h > 0 {
            (cap.tmpl_w, cap.tmpl_h)
        } else {
            (110, 300)
        };

        let check_body = serde_json::json!({
            "id": cap.id,
            "data": {
                "bgImageWidth": bg_w,
                "bgImageHeight": bg_h,
                "sliderImageWidth": tmpl_w,
                "sliderImageHeight": tmpl_h,
                "startTime": fmt(start),
                "stopTime": fmt(stop),
                "trackList": track,
            }
        });

        let chk = match client
            .post(format!("{}/captcha/check", base))
            .header("Content-Type", "application/json")
            .header("User-Agent", BROWSER_UA)
            .header("Referer", song_page.as_str())
            .json(&check_body)
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                last_fail_msg =
                    Some(format!("captcha/check: {}", format_reqwest_err(&e)));
                continue;
            }
        };
        if !chk.status().is_success() {
            last_fail_msg = Some(format!("captcha/check HTTP {}", chk.status()));
            continue;
        }
        let chk_text = chk.text().await.unwrap_or_default();
        let chk_json: Value = serde_json::from_str(&chk_text).unwrap_or(Value::Null);
        let chk_ok = chk_json
            .get("success")
            .and_then(|b| b.as_bool())
            .unwrap_or(false);
        if chk_ok {
            captcha_id = cap.id;
            info!(
                target: "download",
                "captcha 通过 attempt={} drag_x={} id={}",
                attempt,
                drag_x,
                captcha_id
            );
            emit_download_step(&mut task, &emit, 0.40, "验证通过，获取音频地址…");
            break;
        }

        warn!(
            target: "download",
            "captcha/check 未通过 attempt={} drag_x={} body={}",
            attempt,
            drag_x,
            chk_text.chars().take(300).collect::<String>()
        );
        last_fail_msg = Some(format!("验证未通过（x={drag_x}）: {chk_text}"));
    }

    if captcha_id.is_empty() {
        download_fail_emit(
            &mut task,
            &emit,
            &job,
            last_fail_msg.unwrap_or_else(|| "验证码校验失败".to_string()),
        );
        return;
    }

    // captcha 通过后 token 时效很短，立刻换链接；短暂 150~350ms 抖动模拟真人。
    let gap_ms = {
        let mut rng = rand::thread_rng();
        rng.gen_range(150u64..350u64)
    };
    tokio::time::sleep(Duration::from_millis(gap_ms)).await;

    emit_download_step(&mut task, &emit, 0.43, "请求下载链接…");
    let url_r = match client
        .get(format!("{}/captcha/check/getMusicUrl", base))
        .query(&[
            ("captchaId", captcha_id.as_str()),
            ("id", job.source_id.as_str()),
            ("br", job.quality.as_str()),
        ])
        .header("User-Agent", BROWSER_UA)
        .header("Referer", song_page.as_str())
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            download_fail_emit(
                &mut task,
                &emit,
                &job,
                format!("getMusicUrl: {}", format_reqwest_err(&e)),
            );
            return;
        }
    };
    if !url_r.status().is_success() {
        download_fail_emit(
            &mut task,
            &emit,
            &job,
            format!("getMusicUrl HTTP {}", url_r.status()),
        );
        return;
    }
    let url_json: Value = match url_r.json::<Value>().await {
        Ok(v) => v,
        Err(e) => {
            download_fail_emit(
                &mut task,
                &emit,
                &job,
                format!("解析 getMusicUrl JSON: {}", format_reqwest_err(&e)),
            );
            return;
        }
    };
    if url_json.get("code").and_then(|c| c.as_i64()) != Some(200) {
        download_fail_emit(
            &mut task,
            &emit,
            &job,
            format!("获取下载链接失败: {url_json}"),
        );
        return;
    }
    let Some(music_url) = url_json.get("result").and_then(|r| r.as_str()) else {
        download_fail_emit(&mut task, &emit, &job, "响应无 result URL".to_string());
        return;
    };

    let ext = if job.quality == "flac" { ".flac" } else { ".mp3" };
    let name = sanitize_filename(&format!("{} - {}{}", job.title, job.artist, ext));
    let root = dest_root();
    if let Err(e) = tokio::fs::create_dir_all(&root).await {
        download_fail_emit(&mut task, &emit, &job, format!("创建目录: {e}"));
        return;
    }
    let out_path = root.join(name);

    emit_download_step(&mut task, &emit, 0.46, "连接 CDN，开始下载…");
    info!(
        target: "download",
        "streaming audio source_id={} url_len={}",
        job.source_id,
        music_url.len()
    );

    let resp = match client
        .get(music_url)
        .header("User-Agent", BROWSER_UA)
        .header("Referer", song_page.as_str())
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            download_fail_emit(
                &mut task,
                &emit,
                &job,
                format!("下载音频: {}", format_reqwest_err(&e)),
            );
            return;
        }
    };
    if !resp.status().is_success() {
        download_fail_emit(
            &mut task,
            &emit,
            &job,
            format!("音频 HTTP {}", resp.status()),
        );
        return;
    }
    let total = resp.content_length().unwrap_or(0);
    let mut stream = resp.bytes_stream();
    let mut file = match tokio::fs::File::create(&out_path).await {
        Ok(f) => f,
        Err(e) => {
            download_fail_emit(&mut task, &emit, &job, format!("创建文件: {e}"));
            return;
        }
    };

    let mut received: u64 = 0;
    let mut last_emit = Instant::now();
    let mut acc_emit: usize = 0;
    const EMIT_EVERY: Duration = Duration::from_millis(280);
    const EMIT_BYTES: usize = 256 * 1024;

    while let Some(item) = stream.next().await {
        let chunk = match item {
            Ok(c) => c,
            Err(e) => {
                download_fail_emit(
                    &mut task,
                    &emit,
                    &job,
                    format!("下载流: {}", format_reqwest_err(&e)),
                );
                return;
            }
        };
        let n = chunk.len() as u64;
        if let Err(e) = file.write_all(&chunk).await {
            download_fail_emit(&mut task, &emit, &job, format!("写入: {e}"));
            return;
        }
        received += n;
        acc_emit += chunk.len();

        let time_ok = last_emit.elapsed() >= EMIT_EVERY;
        let size_ok = acc_emit >= EMIT_BYTES;
        if time_ok || size_ok {
            acc_emit = 0;
            last_emit = Instant::now();
            let frac = if total > 0 {
                (received as f64 / total as f64).min(1.0)
            } else {
                (1.0 - (-(received as f64) / 5_000_000.0).exp()).min(0.92)
            };
            let p = 0.48 + 0.48 * frac;
            let mb = received as f64 / 1_048_576.0;
            let msg = if total > 0 {
                format!(
                    "下载中 {mb:.1} / {:.1} MB",
                    total as f64 / 1_048_576.0
                )
            } else {
                format!("下载中 {mb:.1} MB…")
            };
            emit_download_step(&mut task, &emit, p.min(0.98), msg);
        }
    }

    if let Err(e) = file.flush().await {
        download_fail_emit(&mut task, &emit, &job, format!("写入: {e}"));
        return;
    }

    let done = received;
    if total > 0 {
        task.progress = (done as f64) / (total as f64);
    } else {
        task.progress = 0.99;
    }
    emit(task.clone());

    if let Err(e) = record_download_success() {
        log::warn!(
            target: "download",
            "saved file but daily count failed: {} | source_id={}",
            e,
            job.source_id
        );
        task.message = Some(format!("已保存但计数失败: {e}"));
    } else {
        task.message = Some(format!("已保存: {}", out_path.display()));
    }
    persist_downloaded_record(&app, out_path.as_path(), &job, done);
    task.status = "completed".to_string();
    task.progress = 1.0;
    info!(
        target: "download",
        "completed source_id={} path={}",
        job.source_id,
        out_path.display()
    );
    emit(task);
}

/// 走 tianai-captcha + getMusicUrl 拿到站点授权的**完整**音频直链；
/// 与 `run_one_job` 的上半段行为一致，但不发事件、不占用每日下载额度，
/// 专供「在线播放」复用（`pjmp3::cache_full_audio_file`）。
///
/// 返回值是可直接流式下载的 URL（已通过验证码签名，TTL 很短，拿到后应立刻下载）。
pub async fn fetch_full_music_url(
    client: &Client,
    source_id: &str,
    quality: &str,
) -> Result<String, String> {
    let sid = source_id.trim();
    if sid.is_empty() {
        return Err("无效的歌曲 ID".to_string());
    }
    let br = match quality.trim().to_ascii_lowercase().as_str() {
        "flac" => "flac",
        "320" | "hq" => "320",
        _ => "128",
    };
    let base = BASE_URL.trim_end_matches('/');
    let song_page = format!("{}/song.php?id={}", base, sid);

    const MAX_ATTEMPTS: usize = 4;
    let mut captcha_id = String::new();
    let mut last_err: Option<String> = None;

    for attempt in 1..=MAX_ATTEMPTS {
        let gen_r = match get_captcha_gen_with_retry(client, base).await {
            Ok(r) => r,
            Err(e) => {
                last_err = Some(format!("captcha/gen: {}", format_reqwest_err(&e)));
                continue;
            }
        };
        if !gen_r.status().is_success() {
            last_err = Some(format!("captcha/gen HTTP {}", gen_r.status()));
            continue;
        }
        let gen_text = match gen_r.text().await {
            Ok(t) => t,
            Err(e) => {
                last_err = Some(format!("读取验证码响应: {}", format_reqwest_err(&e)));
                continue;
            }
        };
        let payload: Value = match serde_json::from_str(&gen_text) {
            Ok(v) => v,
            Err(e) => {
                last_err = Some(format!("验证码响应非 JSON: {e}"));
                continue;
            }
        };
        let Some(cap) = extract_tianai_captcha(&payload) else {
            last_err = Some("无法解析验证码响应结构".to_string());
            continue;
        };
        let drag_x = match solve_tianai_slider(&cap.background_b64, &cap.template_b64) {
            Some(v) => v,
            None => {
                last_err = Some("自动滑块匹配失败".to_string());
                continue;
            }
        };

        let start = chrono::Local::now();
        let drag_duration_ms: u64 = {
            let mut rng = rand::thread_rng();
            rng.gen_range(1100u64..1800u64)
        };
        let stop = start + chrono::Duration::milliseconds(drag_duration_ms as i64);
        let fmt = |t: chrono::DateTime<chrono::Local>| t.format("%Y-%m-%d %H:%M:%S").to_string();
        let mid_x = (drag_x as f64 * 0.55).round() as i32;
        let mid_t = (drag_duration_ms as f64 * 0.5).round() as i64;
        let end_t = drag_duration_ms as i64;
        let track = serde_json::json!([
            {"x": 0, "y": 0, "type": "down", "t": 0},
            {"x": mid_x, "y": 4, "type": "move", "t": mid_t},
            {"x": drag_x, "y": 6, "type": "move", "t": end_t - 50},
            {"x": drag_x, "y": 6, "type": "up", "t": end_t},
        ]);
        let (bg_w, bg_h) = if cap.bg_w > 0 && cap.bg_h > 0 {
            (cap.bg_w, cap.bg_h)
        } else {
            (600, 300)
        };
        let (tmpl_w, tmpl_h) = if cap.tmpl_w > 0 && cap.tmpl_h > 0 {
            (cap.tmpl_w, cap.tmpl_h)
        } else {
            (110, 300)
        };
        let check_body = serde_json::json!({
            "id": cap.id,
            "data": {
                "bgImageWidth": bg_w,
                "bgImageHeight": bg_h,
                "sliderImageWidth": tmpl_w,
                "sliderImageHeight": tmpl_h,
                "startTime": fmt(start),
                "stopTime": fmt(stop),
                "trackList": track,
            }
        });
        let chk = match client
            .post(format!("{}/captcha/check", base))
            .header("Content-Type", "application/json")
            .header("User-Agent", BROWSER_UA)
            .header("Referer", song_page.as_str())
            .json(&check_body)
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                last_err = Some(format!("captcha/check: {}", format_reqwest_err(&e)));
                continue;
            }
        };
        if !chk.status().is_success() {
            last_err = Some(format!("captcha/check HTTP {}", chk.status()));
            continue;
        }
        let chk_text = chk.text().await.unwrap_or_default();
        let chk_json: Value = serde_json::from_str(&chk_text).unwrap_or(Value::Null);
        let chk_ok = chk_json
            .get("success")
            .and_then(|b| b.as_bool())
            .unwrap_or(false);
        if chk_ok {
            captcha_id = cap.id;
            info!(
                target: "play-full",
                "captcha ok attempt={} source_id={} drag_x={}",
                attempt,
                sid,
                drag_x
            );
            break;
        }
        warn!(
            target: "play-full",
            "captcha not passed attempt={} source_id={} drag_x={} body_len={}",
            attempt,
            sid,
            drag_x,
            chk_text.len()
        );
        last_err = Some(format!("验证未通过（x={drag_x}）"));
    }

    if captcha_id.is_empty() {
        return Err(last_err.unwrap_or_else(|| "验证码校验失败".to_string()));
    }

    // 立刻换链接；TTL 很短。
    let gap_ms = {
        let mut rng = rand::thread_rng();
        rng.gen_range(150u64..350u64)
    };
    tokio::time::sleep(Duration::from_millis(gap_ms)).await;

    let url_r = client
        .get(format!("{}/captcha/check/getMusicUrl", base))
        .query(&[
            ("captchaId", captcha_id.as_str()),
            ("id", sid),
            ("br", br),
        ])
        .header("User-Agent", BROWSER_UA)
        .header("Referer", song_page.as_str())
        .send()
        .await
        .map_err(|e| format!("getMusicUrl: {}", format_reqwest_err(&e)))?;
    if !url_r.status().is_success() {
        return Err(format!("getMusicUrl HTTP {}", url_r.status()));
    }
    let url_json: Value = url_r
        .json::<Value>()
        .await
        .map_err(|e| format!("解析 getMusicUrl JSON: {}", format_reqwest_err(&e)))?;
    if url_json.get("code").and_then(|c| c.as_i64()) != Some(200) {
        return Err(format!("getMusicUrl 业务失败: {url_json}"));
    }
    let music = url_json
        .get("result")
        .and_then(|r| r.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if music.is_empty() {
        return Err("getMusicUrl 无 result URL".to_string());
    }
    info!(
        target: "play-full",
        "music url ready source_id={} br={} url_len={}",
        sid,
        br,
        music.len()
    );
    Ok(music)
}

/// 流式下载音频到文件（不发 Tauri 事件、不计每日额度）。供在线播放的本地缓存复用。
pub async fn stream_audio_to_file(
    client: &Client,
    music_url: &str,
    referer: &str,
    out_path: &Path,
) -> Result<u64, String> {
    let resp = client
        .get(music_url)
        .header("User-Agent", BROWSER_UA)
        .header("Referer", referer)
        .send()
        .await
        .map_err(|e| format!("音频请求: {}", format_reqwest_err(&e)))?;
    if !resp.status().is_success() {
        return Err(format!("音频 HTTP {}", resp.status()));
    }
    if let Some(parent) = out_path.parent() {
        if let Err(e) = tokio::fs::create_dir_all(parent).await {
            return Err(format!("创建目录: {e}"));
        }
    }
    let mut file = tokio::fs::File::create(out_path)
        .await
        .map_err(|e| format!("创建文件: {e}"))?;
    let mut stream = resp.bytes_stream();
    let mut received: u64 = 0;
    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| format!("下载流: {}", format_reqwest_err(&e)))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("写入: {e}"))?;
        received += chunk.len() as u64;
    }
    file.flush().await.map_err(|e| format!("写入: {e}"))?;
    Ok(received)
}
