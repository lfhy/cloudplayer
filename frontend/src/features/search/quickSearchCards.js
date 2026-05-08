// Quick-search card renderer keeps the home suggestions randomized without bloating the page template.
const quickSearchCardPool = [
  { seed: "国风", kicker: "Chinese Style", title: "国风", text: "适合找古风、戏腔、诗意编曲这类中文风格作品" },
  { seed: "日系", kicker: "Japanese", title: "日系", text: "快速拉起日系流行、动画主题曲和轻摇滚相关结果" },
  { seed: "轻音乐", kicker: "Easy Listening", title: "轻音乐", text: "适合工作、阅读和放松时听的人声较少曲目" },
  { seed: "二次元", kicker: "ACG", title: "二次元", text: "适合搜动画、游戏、Vocaloid 和 ACG 向热门歌曲" },
  { seed: "摇滚", kicker: "Rock", title: "摇滚", text: "适合找吉他、现场感和更有冲击力的编曲内容" },
  { seed: "民谣", kicker: "Folk", title: "民谣", text: "更适合找木吉他、人声叙事和安静氛围的作品" },
  { seed: "爵士", kicker: "Jazz", title: "爵士", text: "适合找器乐、即兴和夜晚氛围感更强的内容" },
  { seed: "纯音乐", kicker: "Instrumental", title: "纯音乐", text: "适合快速拉起一批无歌词或器乐向的结果" },
  { seed: "流行", kicker: "Pop", title: "流行", text: "适合直接搜大众热门、传唱度高的曲目" },
  { seed: "古典", kicker: "Classical", title: "古典", text: "适合找交响、钢琴和更偏结构化的作品" },
  { seed: "电音", kicker: "EDM", title: "电音", text: "适合找节奏更强、适合夜跑和开车的曲目" },
  { seed: "说唱", kicker: "Rap", title: "说唱", text: "适合找节拍密集、强调歌词表达的作品" },
  { seed: "R&B", kicker: "R&B", title: "R&B", text: "适合找律动感更强、氛围更松弛的歌声" },
  { seed: "治愈", kicker: "Healing", title: "治愈", text: "适合找情绪更柔和、放松感更明显的音乐" },
  { seed: "伤感", kicker: "Emotional", title: "伤感", text: "适合找情绪表达更直接的慢歌和抒情曲" },
  { seed: "经典", kicker: "Classic", title: "经典", text: "适合找经常被反复播放的老歌和代表作" },
];

function pickRandomSubset(items, count) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next.slice(0, Math.min(count, next.length));
}

function buildCardButton(card, onSearchSeed) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "search-category-card";
  button.dataset.searchSeed = card.seed;
  button.innerHTML = `
    <span class="search-category-card__kicker">${card.kicker}</span>
    <strong>${card.title}</strong>
    <span>${card.text}</span>
  `;
  button.addEventListener("click", () => onSearchSeed(card.seed));
  return button;
}

export function renderSearchQuickCards(container, onSearchSeed) {
  if (!container) return;
  container.innerHTML = "";
  const selectedCards = pickRandomSubset(quickSearchCardPool, 7);
  const randomSeed = quickSearchCardPool[Math.floor(Math.random() * quickSearchCardPool.length)]?.seed || "流行";
  selectedCards.forEach((card) => {
    container.appendChild(buildCardButton(card, onSearchSeed));
  });
  const randomButton = document.createElement("button");
  randomButton.type = "button";
  randomButton.className = "search-category-card search-category-card--shuffle";
  randomButton.dataset.searchSeed = "随便听听";
  randomButton.innerHTML = `
    <span class="search-category-card__kicker">Shuffle</span>
    <strong>随便听听</strong>
    <span>本次随机关键词：${randomSeed}</span>
  `;
  randomButton.addEventListener("click", () => {
    onSearchSeed(randomSeed);
  });
  container.appendChild(randomButton);
}
