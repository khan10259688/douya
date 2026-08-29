const STORAGE_KEY = 'pregnancy_weight_records';

const PAGE_SIZE = 20;

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'morning', label: '晨起' },
  { key: 'daytime', label: '日间' },
];

function normalizeType(periodKey) {
  return periodKey === 'morning' ? 'morning' : 'daytime';
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 把扁平记录按月份分组
function groupByMonth(records) {
  const groups = {};
  records.forEach((r) => {
    const month = r.date.slice(0, 7); // YYYY-MM
    if (!groups[month]) groups[month] = [];
    groups[month].push(r);
  });
  return Object.keys(groups)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((month) => {
      const ym = month.split('-');
      return {
        month,
        monthLabel: `${ym[0]}年${parseInt(ym[1])}月`,
        items: groups[month],
      };
    });
}

Page({
  data: {
    allRecords: [],
    filtered: [],
    groups: [],
    shownCount: 0,
    totalCount: 0,
    hasMore: true,
    filter: 'all',
    filters: FILTERS,
    loading: false,
    deleting: false,
  },

  onLoad() {
    this.loadAll();
  },

  onShow() {
    // 从详情页删除后回到本页需刷新
    if (this._needRefresh) {
      this._needRefresh = false;
      this.loadAll();
    }
  },

  onPullDownRefresh() {
    this.loadAll(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    this.loadMore();
  },

  // 读取本地全部记录（已排序：新→旧）
  loadAll(cb) {
    let records = [];
    try {
      records = wx.getStorageSync(STORAGE_KEY) || [];
    } catch (err) {
      records = [];
    }
    records = records.sort((a, b) => {
      const ta = `${a.date} ${a.time || ''}`;
      const tb = `${b.date} ${b.time || ''}`;
      return ta < tb ? 1 : -1;
    });

    this.setData({
      allRecords: records,
      totalCount: records.length,
      filter: 'all',
    }, () => {
      this.applyFilter();
      if (cb) cb();
    });
  },

  // 按筛选条件过滤
  applyFilter() {
    const { allRecords, filter } = this.data;
    let filtered;
    if (filter === 'all') {
      filtered = allRecords;
    } else {
      filtered = allRecords.filter((r) => normalizeType(r.periodKey) === filter);
    }
    const groups = groupByMonth(filtered);
    this.setData({
      filtered,
      groups,
      shownCount: 0,
      hasMore: true,
    }, () => this.loadMore());
  },

  // 增量展示更多（按月份分组递进）
  loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });

    const { groups, shownCount } = this.data;
    const nextCount = shownCount + 1; // 每次多展示一个月份组
    const shownGroups = groups.slice(0, nextCount);
    const items = [];
    shownGroups.forEach((g) => g.items.forEach((r) => items.push(r)));

    this.setData({
      displayedGroups: shownGroups,
      shownCount: nextCount,
      hasMore: nextCount < groups.length,
      loading: false,
    });
  },

  // 切换筛选
  onSelectFilter(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ filter: key }, () => this.applyFilter());
  },

  // 删除单条
  deleteRecord(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除记录',
      content: '确定删除这条体重记录吗？',
      confirmColor: '#FF6B81',
      success: (res) => {
        if (!res.confirm) return;
        let records = [];
        try {
          records = wx.getStorageSync(STORAGE_KEY) || [];
        } catch (err) {}
        records = records.filter((r) => r.id !== id);
        try {
          wx.setStorageSync(STORAGE_KEY, records);
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'none' });
          return;
        }
        // 云端删除
        wx.cloud.callFunction({
          name: 'quickstartFunctions',
          data: { type: 'deleteWeightRecord', localId: id },
        }).catch(() => {});
        this.loadAll();
        wx.showToast({ title: '已删除', icon: 'none' });
      },
    });
  },

  onShareAppMessage() {
    return {
      title: '🌸 好孕日记 · 陪伴你的孕期每一天',
      path: '/pages/home/home',
    };
  },
});
