// Search page keeps the existing DOM ids so the current search runtime can bind without changes.
export function searchPageTemplate() {
  return `
    <section class="page" data-page="search">
      <div class="search-shell">
        <section id="search-home-view" class="search-view search-view--home is-active">
          <div class="search-hero">
            <div>
              <p class="search-eyebrow">Music Search</p>
              <h1 class="page-title">音乐搜索</h1>
            </div>
            <div class="search-input-wrap">
              <div class="neon-search-wrap search-page-search">
                <div class="neon-search-inner">
                  <input id="page-search" type="search" class="global-search" placeholder="搜索歌曲、歌手、专辑，或搜索你的本地歌单…" autocomplete="off" />
                  <button type="button" id="btn-page-search" class="global-search-btn" title="搜索" aria-label="搜索">
                    <svg class="global-search-btn__icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                  </button>
                </div>
              </div>
              <div class="search-scope-switch" role="tablist" aria-label="搜索范围">
                <button type="button" class="search-scope-chip is-active" data-search-scope="catalog" role="tab" aria-selected="true">音乐资源</button>
                <button type="button" class="search-scope-chip" data-search-scope="playlists" role="tab" aria-selected="false">本地歌单</button>
              </div>
            </div>
          </div>
          <section id="search-suggestions" class="search-suggestions">
            <h2 class="search-section-title">快速搜索</h2>
            <div class="search-category-grid">
              <button type="button" class="search-category-card" data-search-seed="国风">
                <span class="search-category-card__kicker">Chinese Style</span>
                <strong>国风</strong>
                <span>适合找古风、戏腔、诗意编曲这类中文风格作品</span>
              </button>
              <button type="button" class="search-category-card" data-search-seed="日系">
                <span class="search-category-card__kicker">Japanese</span>
                <strong>日系</strong>
                <span>快速拉起日系流行、动画主题曲和轻摇滚相关结果</span>
              </button>
              <button type="button" class="search-category-card" data-search-seed="轻音乐">
                <span class="search-category-card__kicker">Easy Listening</span>
                <strong>轻音乐</strong>
                <span>适合工作、阅读和放松时听的人声较少曲目</span>
              </button>
              <button type="button" class="search-category-card" data-search-seed="二次元">
                <span class="search-category-card__kicker">ACG</span>
                <strong>二次元</strong>
                <span>适合搜动画、游戏、Vocaloid 和 ACG 向热门歌曲</span>
              </button>
              <button type="button" class="search-category-card" data-search-seed="民谣">
                <span class="search-category-card__kicker">Folk</span>
                <strong>民谣</strong>
                <span>更适合找木吉他、人声叙事和安静氛围的作品</span>
              </button>
              <button type="button" class="search-category-card" data-search-seed="爵士">
                <span class="search-category-card__kicker">Jazz</span>
                <strong>爵士</strong>
                <span>适合找器乐、即兴和夜晚氛围感更强的内容</span>
              </button>
              <button type="button" class="search-category-card" data-search-seed="摇滚">
                <span class="search-category-card__kicker">Rock</span>
                <strong>摇滚</strong>
                <span>适合找吉他、现场感和更有冲击力的编曲内容</span>
              </button>
              <button type="button" class="search-category-card" data-search-seed="随便听听">
                <span class="search-category-card__kicker">Shuffle</span>
                <strong>随便听听</strong>
                <span>适合直接拉起一批轻松、不设限的随机探索结果</span>
              </button>
            </div>
          </section>
        </section>
        <section id="search-results-view" class="search-view search-view--results" hidden>
          <div class="search-results-topbar">
            <div class="search-results-topbar__main">
              <div class="neon-search-wrap search-page-search search-results-search">
                <div class="neon-search-inner">
                  <input id="page-search-results" type="search" class="global-search" placeholder="继续搜索歌曲、歌手、专辑，或搜索你的本地歌单…" autocomplete="off" />
                  <button type="button" id="btn-page-search-results" class="global-search-btn" title="搜索" aria-label="搜索">
                    <svg class="global-search-btn__icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                  </button>
                </div>
              </div>
              <div class="search-scope-switch search-results-scope" role="tablist" aria-label="搜索范围">
                <button type="button" class="search-scope-chip is-active" data-search-scope="catalog" role="tab" aria-selected="true">音乐资源</button>
                <button type="button" class="search-scope-chip" data-search-scope="playlists" role="tab" aria-selected="false">本地歌单</button>
              </div>
            </div>
            <div class="search-results-topbar__side">
              <p id="search-results-summary" class="search-results-summary muted"></p>
              <div class="search-results-actions">
                <button type="button" id="btn-play-all" class="btn-accent search-action-btn" disabled>▶ 播放全部</button>
                <button type="button" id="btn-search-batch-mode" class="btn-accent search-action-btn">批量操作</button>
                <button type="button" id="btn-search-select-all" class="btn-accent search-action-btn" hidden>全选</button>
                <button type="button" id="btn-search-add-selected" class="btn-accent search-action-btn" hidden disabled>添加到歌单</button>
                <button type="button" id="btn-search-batch-done" class="btn-accent search-action-btn" hidden>完成</button>
              </div>
            </div>
          </div>
          <div id="search-results-catalog" class="search-results-panel">
            <div class="discover-scroll" id="search-results-scroll">
              <div class="table-wrap">
                <table class="search-table" id="search-table">
                  <thead>
                    <tr>
                      <th class="col-check" hidden><input type="checkbox" id="search-select-all-checkbox" aria-label="全选当前搜索结果" /></th>
                      <th class="col-idx">#</th>
                      <th class="col-cover"></th>
                      <th>标题</th>
                      <th>专辑</th>
                      <th class="col-dur">时长</th>
                    </tr>
                  </thead>
                  <tbody></tbody>
                </table>
              </div>
            </div>
            <div id="search-results-tail" class="search-results-tail" hidden>
              <span id="search-page-info" class="search-page-info muted"></span>
            </div>
          </div>
          <section id="search-results-playlists" class="search-results-panel" hidden>
            <div class="search-local-head">
              <h2 class="search-section-title">本地歌单</h2>
              <p id="search-playlist-info" class="muted"></p>
            </div>
            <div id="search-playlist-list" class="search-playlist-list"></div>
          </section>
        </section>
      </div>
    </section>
  `;
}
