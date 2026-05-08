import { trackTableTemplate } from "../components/trackTableTemplate.js";

// Recent page is a thin table container for playback history.
export function recentPageTemplate() {
  return `
    <section class="page" data-page="recent">
      <div class="page-heading">
        <div>
          <h1 class="page-title">最近播放</h1>
        </div>
      </div>
      ${trackTableTemplate({ id: "recent-plays-table" })}
    </section>
  `;
}
