//! 端到端自检：调用 pjmp3 captcha/gen，用 Rust 求解滑块，POST captcha/check 看是否通过。
//! 运行：`cargo run --example probe_captcha`

use cloudplayer_tauri_lib::captcha_slider::solve_tianai_slider;
use reqwest::Client;
use serde_json::Value;

const BASE: &str = "https://pjmp3.com";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        .http1_only()
        .build()?;

    for attempt in 1..=3 {
        println!("\n=== attempt {attempt} ===");
        let gen_text = client
            .get(format!("{BASE}/captcha/gen"))
            .header("Referer", format!("{BASE}/"))
            .send()
            .await?
            .text()
            .await?;

        let v: Value = serde_json::from_str(&gen_text)?;
        let id = v["id"].as_str().unwrap().to_string();
        let cap = &v["captcha"];
        let bg = cap["backgroundImage"].as_str().unwrap();
        let tmpl = cap["templateImage"].as_str().unwrap();
        let bw = cap["backgroundImageWidth"].as_u64().unwrap_or(600) as u32;
        let bh = cap["backgroundImageHeight"].as_u64().unwrap_or(300) as u32;
        let tw = cap["templateImageWidth"].as_u64().unwrap_or(110) as u32;
        let th = cap["templateImageHeight"].as_u64().unwrap_or(300) as u32;
        println!("id={id} bg={bw}x{bh} tmpl={tw}x{th}");

        let drag_x = match solve_tianai_slider(bg, tmpl) {
            Some(x) => x,
            None => {
                println!("solver returned None");
                continue;
            }
        };
        println!("drag_x = {drag_x}");

        let start = chrono::Local::now();
        let stop = start + chrono::Duration::milliseconds(1400);
        let fmt = |t: chrono::DateTime<chrono::Local>| t.format("%Y-%m-%d %H:%M:%S").to_string();
        let body = serde_json::json!({
            "id": id,
            "data": {
                "bgImageWidth": bw,
                "bgImageHeight": bh,
                "sliderImageWidth": tw,
                "sliderImageHeight": th,
                "startTime": fmt(start),
                "stopTime": fmt(stop),
                "trackList": [
                    {"x": 0, "y": 0, "type": "down", "t": 0},
                    {"x": (drag_x as f64 * 0.55) as i32, "y": 3, "type": "move", "t": 700},
                    {"x": drag_x, "y": 5, "type": "move", "t": 1350},
                    {"x": drag_x, "y": 5, "type": "up", "t": 1400},
                ]
            }
        });

        let resp = client
            .post(format!("{BASE}/captcha/check"))
            .header("Referer", format!("{BASE}/"))
            .json(&body)
            .send()
            .await?;
        let status = resp.status();
        let text = resp.text().await?;
        println!("check status={status} body={text}");

        if text.contains("\"success\":true") {
            println!("✅ check passed with drag_x={drag_x}");

            // 验 getMusicUrl
            let song_id = std::env::var("PROBE_SONG_ID").unwrap_or_else(|_| "206095113".into());
            let br = std::env::var("PROBE_BR").unwrap_or_else(|_| "320".into());
            let url_text = client
                .get(format!("{BASE}/captcha/check/getMusicUrl"))
                .query(&[
                    ("captchaId", id.as_str()),
                    ("id", song_id.as_str()),
                    ("br", br.as_str()),
                ])
                .header("Referer", format!("{BASE}/song.php?id={song_id}"))
                .send()
                .await?
                .text()
                .await?;
            println!("getMusicUrl body={url_text}");
            return Ok(());
        }
    }
    println!("all attempts failed");
    Ok(())
}
