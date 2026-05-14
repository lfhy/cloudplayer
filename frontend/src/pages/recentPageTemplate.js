import { trackTableTemplate } from "../components/trackTableTemplate.js";

// Recent page stays thin and exposes only history actions above the shared table.
export function recentPageTemplate() {
  return `
    <section class="page" data-page="recent">
      <div class="page-heading">
        <div>
          <h1 class="page-title">最近播放</h1>
        </div>
        <div class="page-heading__actions">
          <button type="button" id="btn-clear-recent" class="btn-outline">清空</button>
        </div>
      </div>
      ${trackTableTemplate({ id: "recent-plays-table" })}
    </section>
  `;
}
