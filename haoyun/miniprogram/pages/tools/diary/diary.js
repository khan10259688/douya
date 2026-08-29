const toolRecords = require('../../../utils/tool-records.js');

const KIND = 'diary';

const MOODS = [
  { emoji: '😊', label: '开心' },
  { emoji: '🥰', label: '幸福' },
  { emoji: '😌', label: '平静' },
  { emoji: '😴', label: '疲惫' },
  { emoji: '🤢', label: '孕吐' },
  { emoji: '😤', label: '烦躁' },
  { emoji: '😢', label: '低落' },
  { emoji: '🤩', label: '激动' },
];

// 身体感受标签
const SYMPTOMS = [
  { key: 'back_pain', label: '腰酸' },
  { key: 'edema', label: '水肿' },
  { key: 'insomnia', label: '失眠' },
  { key: 'nausea', label: '孕吐' },
  { key: 'cramp', label: '抽筋' },
  { key: 'frequent_urination', label: '尿频' },
  { key: 'heartburn', label: '烧心' },
  { key: 'fatigue', label: '乏力' },
  { key: 'constipation', label: '便秘' },
  { key: 'kick_active', label: '胎动频繁' },
];

Page({
  data: {
    moods: MOODS,
    symptoms: SYMPTOMS,
    todayDate: '',
    todayMood: -1,
    todayText: '',
    todaySymptoms: [],
    entries: [],
  },

  onLoad() {
    this.loadToday();
    this.render(toolRecords.readLocal(KIND));
    toolRecords.syncWithCloud(KIND, (rs) => this.render(rs));
  },

  onShow() {
    this.loadToday();
    this.render(toolRecords.readLocal(KIND));
  },

  formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  formatDateCN(dateStr) {
    const p = dateStr.split('-');
    return `${p[0]}年${parseInt(p[1])}月${parseInt(p[2])}日`;
  },

  formatTime(d) {
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  },

  weekday(dateStr) {
    const p = dateStr.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  },

  // 加载今天的日记（若有）
  loadToday() {
    const todayStr = this.formatDate(new Date());
    const records = toolRecords.readLocal(KIND);
    const today = records.find((r) => r.date === todayStr);
    this.setData({
      todayDate: this.formatDateCN(todayStr),
      todayMood: today ? today.mood : -1,
      todayText: today ? (today.content || '') : '',
      todaySymptoms: today ? (today.symptoms || []) : [],
    });
  },

  // 渲染历史列表
  render(records) {
    const entries = [...records]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((r) => {
        const symptomLabels = (r.symptoms || []).map((k) => {
          const s = SYMPTOMS.find((o) => o.key === k);
          return s ? s.label : '';
        }).filter(Boolean);
        return {
          ...r,
          dateCN: this.formatDateCN(r.date),
          weekday: this.weekday(r.date),
          moodEmoji: MOODS[r.mood] ? MOODS[r.mood].emoji : '',
          moodLabel: MOODS[r.mood] ? MOODS[r.mood].label : '',
          symptomLabels,
        };
      });
    this.setData({ entries });
  },

  onSelectMood(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({ todayMood: this.data.todayMood === idx ? -1 : idx });
  },

  onTextInput(e) {
    this.setData({ todayText: e.detail.value });
  },

  // 切换身体感受标签
  onToggleSymptom(e) {
    const key = e.currentTarget.dataset.key;
    let symptoms = [...this.data.todaySymptoms];
    const idx = symptoms.indexOf(key);
    if (idx !== -1) symptoms.splice(idx, 1);
    else symptoms.push(key);
    this.setData({ todaySymptoms: symptoms });
  },

  // 保存今日日记（按日期 upsert，云端按 localId 更新）
  saveToday() {
    const { todayMood, todayText, todaySymptoms } = this.data;
    if (todayMood < 0 && !todayText.trim() && todaySymptoms.length === 0) {
      wx.showToast({ title: '请选择心情或感受', icon: 'none' });
      return;
    }
    const now = new Date();
    const todayStr = this.formatDate(now);
    const records = toolRecords.readLocal(KIND);
    let record = records.find((r) => r.date === todayStr);
    if (record) {
      record.mood = todayMood;
      record.content = (todayText || '').trim();
      record.symptoms = todaySymptoms;
      record.time = this.formatTime(now);
    } else {
      record = {
        id: `${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        date: todayStr,
        time: this.formatTime(now),
        mood: todayMood,
        content: (todayText || '').trim(),
        symptoms: todaySymptoms,
      };
      records.push(record);
    }
    toolRecords.writeLocal(KIND, records);
    toolRecords.uploadRecord(KIND, record);
    this.render(records);
    wx.showToast({ title: '已记录 🌸', icon: 'success' });
  },

  deleteEntry(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除日记',
      content: '确定删除这条日记吗？',
      confirmColor: '#FF6B81',
      success: (res) => {
        if (!res.confirm) return;
        const records = toolRecords.readLocal(KIND).filter((r) => r.id !== id);
        toolRecords.writeLocal(KIND, records);
        toolRecords.deleteCloudRecord(KIND, id);
        if (records.find((r) => r.id === id) === undefined && this.data.todayText) {
          // 如果删的是今天的，清空输入
        }
        this.render(records);
        // 如果删的是今天，重置输入
        const todayStr = this.formatDate(new Date());
        if (!records.find((r) => r.date === todayStr)) {
          this.setData({ todayMood: -1, todayText: '' });
        }
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
