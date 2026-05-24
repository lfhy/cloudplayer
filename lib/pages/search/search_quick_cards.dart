// Search quick cards preserve the legacy recommendation copy while the page decides when to surface them.

import 'dart:math';

class SearchQuickCard {
  const SearchQuickCard({
    required this.seed,
    required this.kicker,
    required this.title,
    required this.text,
  });

  final String seed;
  final String kicker;
  final String title;
  final String text;
}

const List<SearchQuickCard> searchQuickCardPool = <SearchQuickCard>[
  SearchQuickCard(
    seed: '国风',
    kicker: 'Chinese Style',
    title: '国风',
    text: '适合找古风、戏腔、诗意编曲这类中文风格作品',
  ),
  SearchQuickCard(
    seed: '日系',
    kicker: 'Japanese',
    title: '日系',
    text: '快速拉起日系流行、动画主题曲和轻摇滚相关结果',
  ),
  SearchQuickCard(
    seed: '轻音乐',
    kicker: 'Easy Listening',
    title: '轻音乐',
    text: '适合工作、阅读和放松时听的人声较少曲目',
  ),
  SearchQuickCard(
    seed: '二次元',
    kicker: 'ACG',
    title: '二次元',
    text: '适合搜动画、游戏、Vocaloid 和 ACG 向热门歌曲',
  ),
  SearchQuickCard(
    seed: '摇滚',
    kicker: 'Rock',
    title: '摇滚',
    text: '适合找吉他、现场感和更有冲击力的编曲内容',
  ),
  SearchQuickCard(
    seed: '民谣',
    kicker: 'Folk',
    title: '民谣',
    text: '更适合找木吉他、人声叙事和安静氛围的作品',
  ),
  SearchQuickCard(
    seed: '爵士',
    kicker: 'Jazz',
    title: '爵士',
    text: '适合找器乐、即兴和夜晚氛围感更强的内容',
  ),
  SearchQuickCard(
    seed: '纯音乐',
    kicker: 'Instrumental',
    title: '纯音乐',
    text: '适合快速拉起一批无歌词或器乐向的结果',
  ),
  SearchQuickCard(
    seed: '流行',
    kicker: 'Pop',
    title: '流行',
    text: '适合直接搜大众热门、传唱度高的曲目',
  ),
  SearchQuickCard(
    seed: '古典',
    kicker: 'Classical',
    title: '古典',
    text: '适合找交响、钢琴和更偏结构化的作品',
  ),
  SearchQuickCard(
    seed: '电音',
    kicker: 'EDM',
    title: '电音',
    text: '适合找节奏更强、适合夜跑和开车的曲目',
  ),
  SearchQuickCard(
    seed: '说唱',
    kicker: 'Rap',
    title: '说唱',
    text: '适合找节拍密集、强调歌词表达的作品',
  ),
  SearchQuickCard(
    seed: 'R&B',
    kicker: 'R&B',
    title: 'R&B',
    text: '适合找律动感更强、氛围更松弛的歌声',
  ),
  SearchQuickCard(
    seed: '治愈',
    kicker: 'Healing',
    title: '治愈',
    text: '适合找情绪更柔和、放松感更明显的音乐',
  ),
  SearchQuickCard(
    seed: '伤感',
    kicker: 'Emotional',
    title: '伤感',
    text: '适合找情绪表达更直接的慢歌和抒情曲',
  ),
  SearchQuickCard(
    seed: '经典',
    kicker: 'Classic',
    title: '经典',
    text: '适合找经常被反复播放的老歌和代表作',
  ),
];

List<SearchQuickCard> pickSearchQuickCards({int count = 7}) {
  final pool = <SearchQuickCard>[...searchQuickCardPool];
  final random = Random();
  for (var index = pool.length - 1; index > 0; index -= 1) {
    final swapIndex = random.nextInt(index + 1);
    final item = pool[index];
    pool[index] = pool[swapIndex];
    pool[swapIndex] = item;
  }
  return pool.take(count).toList(growable: false);
}

String pickSearchShuffleSeed() {
  final random = Random();
  return searchQuickCardPool[random.nextInt(searchQuickCardPool.length)].seed;
}
