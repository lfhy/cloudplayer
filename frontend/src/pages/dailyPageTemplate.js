import { trackTableTemplate } from "../components/trackTableTemplate.js";

// Daily page only owns the recommendation table shell.
export function dailyPageTemplate() {
  return `
    <section class="page" data-page="daily">
      <div class="page-heading">
        <div>
          <h1 class="page-title">每日推荐</h1>
        </div>
        <div class="page-heading__actions">
          <button type="button" id="btn-play-daily-all" class="btn-accent">▶ 播放全部</button>
          <button type="button" id="btn-save-daily-playlist" class="btn-outline">保存为歌单</button>
          <button type="button" id="btn-refresh-daily" class="btn-outline">重新生成</button>
        </div>
      </div>
      ${trackTableTemplate({ id: "daily-table" })}
    </section>
  `;
}
