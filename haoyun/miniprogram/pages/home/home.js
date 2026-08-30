const DB = wx.cloud.database();
const PREGNANCY_COLLECTION = 'pregnancy_records';

Page({
  data: {
    firstDay: '',
    today: '',
    hasStarted: false,
    lastUpdateTime: '',
    userName: '',
    greetingText: '',
    blessingText: '',
    pregnancyInfo: {
      week: 0,
      day: 0,
      elapsedDays: 0,
      remainingDays: 280,
      progress: 0,
      dueDate: '',
      period: '',
    },
    stageEmoji: '🌱',
    checkItems: [],
    upcomingChecks: [],
    overdueChecks: [],
    completedChecksList: [],
    completedChecks: [], // 已完成的检查项名称列表
    todayDate: '',
    babySize: { size: '', emoji: '', desc: '' },
    weekList: [],
    scrollWeekId: '',
    eggEmoji: '🥚',
    eggStageText: '',
    alertBanner: null,
    bannerDismissed: false,
    expandedGroups: { overdue: false, upcoming: false, done: false },
    showFeedbackSheet: false,
    eggVisible: false,
    eggText: '',
    eggKick: false,
    eggStyle: '',
    eggBurst: false,
    feedbackText: '',
    feedbackTags: [
      { label: '✨ 功能建议' },
      { label: '🐛 体验问题' },
      { label: '📝 内容纠错' },
      { label: '💬 随便聊聊' },
    ],
    selectedTagIndex: -1,
    feedbackSubmitting: false,
    showSettingsSheet: false,
    editName: '',
    editFirstDay: '',
    editFirstDayCN: '',
  },

  onLoad() {
    const today = new Date();
    const todayStr = this.formatDate(today);
    const todayDate = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
    this.setData({ today: todayStr, todayDate });
    this.checkBannerDismissed();
    this.loadUserData();
  },

  onShow() {
    if (this.data.hasStarted) {
      this.calculatePregnancyInfo();
    }
  },

  // 格式化日期为 YYYY-MM-DD
  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  // 格式化显示日期
  formatDateCN(dateStr) {
    const parts = dateStr.split('-');
    return `${parts[0]}年${parseInt(parts[1])}月${parseInt(parts[2])}日`;
  },

  // 加载用户数据
  async loadUserData() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getUserData' },
      });

      if (result && result.success && result.data) {
        const { firstDay, completedChecks, userName } = result.data;
        this.setData({
          firstDay,
          hasStarted: true,
          lastUpdateTime: result.data.lastUpdate || '',
          completedChecks: completedChecks || [],
          userName: userName || '准妈妈',
        });
        this.calculatePregnancyInfo();
      }
    } catch (err) {
      console.error('加载用户数据失败', err);
      this.loadLocalData();
    }
  },

  // 从本地存储加载（降级方案）
  loadLocalData() {
    try {
      const firstDay = wx.getStorageSync('pregnancy_first_day');
      const userName = wx.getStorageSync('pregnancy_user_name') || '准妈妈';
      const completedChecks = wx.getStorageSync('pregnancy_completed_checks') || [];
      if (firstDay) {
        this.setData({ firstDay, hasStarted: true, userName, completedChecks });
        this.calculatePregnancyInfo();
      }
    } catch (err) {
      console.error('加载本地数据失败', err);
    }
  },

  // 名字输入
  onNameInput(e) {
    this.setData({ userName: e.detail.value });
  },

  // 根据时间获取问候语（简短风格：早安/午安/晚安/夜安）
  getGreeting() {
    const hour = new Date().getHours();
    if (hour < 6) return '🌙 夜安';
    if (hour < 12) return '🌤 早安';
    if (hour < 18) return '🌞 午安';
    return '🌙 晚安';
  },

  // 根据孕周生成简短祝福语
  getBlessing(week) {
    const hour = new Date().getHours();
    let timeTip = '';
    if (hour < 6) timeTip = '好好休息，宝宝也在梦里呢 🌙';
    else if (hour < 12) timeTip = '记得吃个营养早餐 🥛';
    else if (hour < 18) timeTip = '午后散散步，保持好心情 🚶';
    else timeTip = '放松一下，听听音乐吧 🎵';

    const weekBlessings = [
      { max: 4, text: '宝宝正在悄悄扎根' },
      { max: 8, text: '小豆芽在努力长大' },
      { max: 12, text: '小心脏开始跳动啦' },
      { max: 16, text: '孕吐快过去了' },
      { max: 20, text: '能感受到胎动了吗' },
      { max: 24, text: '宝宝有听觉了，多和ta说话' },
      { max: 28, text: '孕中期最舒服的时光' },
      { max: 32, text: '好好享受胎动吧' },
      { max: 36, text: '离见面越来越近了' },
      { max: 40, text: '随时准备迎接宝宝' },
    ];

    let weekText = '';
    for (const b of weekBlessings) {
      if (week <= b.max) { weekText = b.text; break; }
    }
    if (!weekText) weekText = '你是最棒的妈妈';

    return `${timeTip} · ${weekText}`;
  },

  // 根据孕周返回宝宝大小参照（CRL头臀长/身长数据来源：WHO fetal growth standards）
  getBabySize(week) {
    const sizes = [
      { max: 4, size: '芝麻粒', emoji: '🫘', desc: '约0.1cm，刚刚着床', develop: '正在分裂成胚胎' },
      { max: 5, size: '苹果籽', emoji: '🫘', desc: '约0.2cm', develop: '神经管开始形成' },
      { max: 6, size: '小扁豆', emoji: '🫘', desc: '约0.5cm', develop: '心脏开始跳动' },
      { max: 7, size: '蓝莓', emoji: '🫐', desc: '约1cm', develop: '四肢芽出现' },
      { max: 8, size: '小芸豆', emoji: '🫘', desc: '约1.6cm', develop: '手指脚趾雏形形成' },
      { max: 9, size: '葡萄', emoji: '🍇', desc: '约2.3cm', develop: '主要器官基本成型' },
      { max: 10, size: '金桔', emoji: '🍊', desc: '约3.1cm', develop: '能吞咽和踢腿' },
      { max: 11, size: '小柠檬', emoji: '🍋', desc: '约4cm', develop: '指纹开始形成' },
      { max: 12, size: '李子', emoji: '🫐', desc: '约5.4cm', develop: '有了反射动作' },
      { max: 13, size: '豌豆荚', emoji: '🫛', desc: '约7.4cm', develop: '能皱眉、吸吮' },
      { max: 14, size: '柠檬', emoji: '🍋', desc: '约8.7cm', develop: '长出细毛（胎毛）' },
      { max: 15, size: '苹果', emoji: '🍎', desc: '约10cm', develop: '能感知光线' },
      { max: 16, size: '牛油果', emoji: '🥑', desc: '约12cm', develop: '会打哈欠了' },
      { max: 17, size: '洋葱', emoji: '🧅', desc: '约13cm', develop: '脂肪开始积累' },
      { max: 18, size: '甜椒', emoji: '🫑', desc: '约14cm', develop: '能听到声音' },
      { max: 19, size: '芒果', emoji: '🥭', desc: '约15cm', develop: '胎动更明显' },
      { max: 20, size: '香蕉', emoji: '🍌', desc: '约16cm', develop: '能吞咽羊水' },
      { max: 21, size: '胡萝卜', emoji: '🥕', desc: '约27cm', develop: '眉毛长出来了' },
      { max: 22, size: '木瓜', emoji: '🍈', desc: '约28cm', develop: '嘴唇更清晰' },
      { max: 23, size: '大芒果', emoji: '🥭', desc: '约29cm', develop: '能听到妈妈声音' },
      { max: 24, size: '玉米', emoji: '🌽', desc: '约30cm', develop: '肺部血管发育' },
      { max: 25, size: '白萝卜', emoji: '🥬', desc: '约34cm', develop: '能抓握' },
      { max: 26, size: '大葱', emoji: '🥬', desc: '约36cm', develop: '眼睛能睁开' },
      { max: 27, size: '花椰菜', emoji: '🥦', desc: '约37cm', develop: '大脑快速发育' },
      { max: 28, size: '大茄子', emoji: '🍆', desc: '约38cm', develop: '能做梦（REM睡眠）' },
      { max: 29, size: '冬瓜', emoji: '🥒', desc: '约39cm', develop: '肌肉和肺在成熟' },
      { max: 30, size: '大白菜', emoji: '🥬', desc: '约40cm', develop: '能调节体温' },
      { max: 31, size: '椰子', emoji: '🥥', desc: '约41cm', develop: '神经系统更完善' },
      { max: 32, size: '菠萝', emoji: '🍍', desc: '约42cm', develop: '指甲长齐了' },
      { max: 33, size: '菠萝', emoji: '🍍', desc: '约44cm', develop: '骨骼变硬' },
      { max: 34, size: '哈密瓜', emoji: '🍈', desc: '约45cm', develop: '中枢神经成熟' },
      { max: 35, size: '南瓜', emoji: '🎃', desc: '约46cm', develop: '肾脏发育完成' },
      { max: 36, size: '小西瓜', emoji: '🍉', desc: '约47cm', develop: '肺部基本成熟' },
      { max: 37, size: '大冬瓜', emoji: '🥬', desc: '约48cm', develop: '算足月了' },
      { max: 38, size: '大西瓜', emoji: '🍉', desc: '约49cm', develop: '准备好出生' },
      { max: 39, size: '大西瓜', emoji: '🍉', desc: '约50cm', develop: '随时可能报到' },
      { max: 40, size: '大西瓜', emoji: '🍉', desc: '约51cm，随时准备出来啦', develop: '准备好和妈妈见面啦' },
    ];
    for (const s of sizes) {
      if (week <= s.max) return s;
    }
    return { size: '小宝贝', emoji: '👶', desc: '已经准备好和妈妈见面啦', develop: '随时出生' };
  },

  // 打开孕期设置抽屉
  openSettingsSheet() {
    const { userName, firstDay } = this.data;
    this.setData({
      showSettingsSheet: true,
      editName: userName || '',
      editFirstDay: firstDay || '',
      editFirstDayCN: firstDay ? this.formatDateCN(firstDay) : '',
    });
  },

  closeSettingsSheet() {
    this.setData({ showSettingsSheet: false });
  },

  onEditNameInput(e) {
    this.setData({ editName: e.detail.value });
  },

  onEditDateChange(e) {
    const value = e.detail.value;
    const parts = value.split('-');
    this.setData({
      editFirstDay: value,
      editFirstDayCN: `${parts[0]}年${parseInt(parts[1])}月${parseInt(parts[2])}日`,
    });
  },

  // 格式化显示日期
  formatDateCN(dateStr) {
    const parts = dateStr.split('-');
    return `${parts[0]}年${parseInt(parts[1])}月${parseInt(parts[2])}日`;
  },

  // 保存设置（昵称+日期一起保存）
  saveSettings() {
    const { editName, editFirstDay } = this.data;
    if (!editName.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    if (!editFirstDay) {
      wx.showToast({ title: '请选择日期', icon: 'none' });
      return;
    }
    const name = editName.trim().slice(0, 10);
    this.setData({
      userName: name,
      firstDay: editFirstDay,
      showSettingsSheet: false,
    });
    wx.setStorageSync('pregnancy_first_day', editFirstDay);
    wx.setStorageSync('pregnancy_user_name', name);
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'savePregnancyDate', firstDay: editFirstDay, userName: name },
    }).catch(() => {});
    this.calculatePregnancyInfo();
    wx.showToast({ title: '已保存', icon: 'success' });
  },

  // 日期选择变化（欢迎页用）
  onDateChange(e) {
    this.setData({ firstDay: e.detail.value });
  },

  // 修改怀孕第一天日期
  onFirstDayChange(e) {
    const newDate = e.detail.value;
    // 修正时区：按本地日期解析，避免 UTC 偏移导致 diffDays 少算
    const parts = newDate.split('-').map(Number);
    const firstDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const today = new Date();
    const diffDays = Math.floor((today - firstDate) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      wx.showToast({ title: '日期不能晚于今天', icon: 'none' });
      return;
    }
    if (diffDays > 300) {
      wx.showToast({ title: '日期不太对，请检查', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '更新中...' });
    this.setData({ firstDay: newDate });
    this.saveDateToCloud(newDate);
  },

  // 保存日期到云端
  async saveDateToCloud(firstDay) {
    const userName = this.data.userName || '准妈妈';
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'savePregnancyDate', firstDay, userName },
      });

      if (result && result.success) {
        wx.setStorageSync('pregnancy_first_day', firstDay);
        wx.setStorageSync('pregnancy_user_name', userName);
        this.setData({
          hasStarted: true,
          lastUpdateTime: this.formatDate(new Date()),
        });
        this.calculatePregnancyInfo();
        wx.hideLoading();
        wx.showToast({ title: '更新成功！', icon: 'success' });
      } else {
        throw new Error('保存失败');
      }
    } catch (err) {
      // 降级到本地
      wx.setStorageSync('pregnancy_first_day', firstDay);
      wx.setStorageSync('pregnancy_user_name', userName);
      this.setData({
        hasStarted: true,
        lastUpdateTime: this.formatDate(new Date()),
      });
      this.calculatePregnancyInfo();
      wx.hideLoading();
      wx.showToast({ title: '已更新', icon: 'success' });
    }
  },

  // 保存日期（首次设置）
  async saveDate() {
    if (!this.data.firstDay) {
      wx.showToast({ title: '请选择日期', icon: 'none' });
      return;
    }

    // 修正时区：按本地日期解析，避免 UTC 偏移导致 diffDays 少算
    const parts = this.data.firstDay.split('-').map(Number);
    const firstDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const today = new Date();
    const diffDays = Math.floor((today - firstDate) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      wx.showToast({ title: '日期不能晚于今天', icon: 'none' });
      return;
    }

    if (diffDays > 300) {
      wx.showToast({ title: '日期似乎不太对，请检查', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });
    await this.saveDateToCloud(this.data.firstDay);
  },

  // 计算孕期信息
  calculatePregnancyInfo() {
    if (!this.data.firstDay) return;

    // 修正时区：把日期字符串当作本地日期 00:00 解析，避免 UTC 偏移导致孕周少算
    const parts = this.data.firstDay.split('-').map(Number);
    const firstDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const today = new Date();

    const elapsedDays = Math.floor((today - firstDate) / (1000 * 60 * 60 * 24));
    if (elapsedDays < 0) return;

    const week = Math.floor(elapsedDays / 7);
    const day = elapsedDays % 7;

    const dueDate = new Date(firstDate);
    dueDate.setDate(dueDate.getDate() + 280);
    const dueDateStr = this.formatDateCN(this.formatDate(dueDate));

    const remainingDays = Math.max(0, 280 - elapsedDays);
    const progress = Math.min(100, Math.round((elapsedDays / 280) * 1000) / 10);

    // 鸡蛋破壳阶段：按进度切换 emoji + 描述
    let eggEmoji = '🥚';
    let eggStageText = '';
    if (progress >= 100) {
      eggEmoji = '🐣';
      eggStageText = '随时见面啦';
    } else if (progress >= 85) {
      eggEmoji = '🐣';
      eggStageText = '快破壳了 · 还有' + remainingDays + '天';
    } else if (progress >= 60) {
      eggEmoji = '🥚';
      eggStageText = '壳裂' + progress + '% · 还有' + remainingDays + '天';
    } else if (progress >= 30) {
      eggEmoji = '🥚';
      eggStageText = '孵化' + progress + '% · 还有' + remainingDays + '天';
    } else {
      eggEmoji = '🥚';
      eggStageText = '孵化' + progress + '%';
    }

    let period = '';
    let stageEmoji = '🌱';
    if (week < 13) {
      period = '孕早期（1-12周）';
      stageEmoji = '🌱';
    } else if (week < 28) {
      period = '孕中期（13-27周）';
      stageEmoji = '🌿';
    } else {
      period = '孕晚期（28-40周）';
      stageEmoji = '🌾';
    }

    const greetingText = this.getGreeting();
    const blessingText = this.getBlessing(week);
    const babySize = this.getBabySize(week);
    const weekList = this.buildWeekList(firstDate, week);

    this.setData({
      'pregnancyInfo.week': week,
      'pregnancyInfo.day': day,
      'pregnancyInfo.elapsedDays': elapsedDays,
      'pregnancyInfo.remainingDays': remainingDays,
      'pregnancyInfo.progress': progress,
      'pregnancyInfo.dueDate': dueDateStr,
      'pregnancyInfo.period': period,
      babySize,
      stageEmoji,
      eggEmoji,
      eggStageText,
      greetingText,
      blessingText,
      weekList,
    }, () => {
      // 定位到当前周（仅孕周变化时滚动，避免每次操作都跳回）
      if (this._lastScrollWeek !== week) {
        this._lastScrollWeek = week;
        setTimeout(() => {
          this.setData({ scrollWeekId: `wk-${week}` });
        }, 300);
      }
    });

    this.calculateCheckItems(week, day);
  },

  // 构建孕周日期对照列表：每周卡片显示该周起止日期
  buildWeekList(firstDate, currentWeek) {
    const maxWeek = Math.max(40, Math.min(42, currentWeek));
    const list = [];
    for (let w = 0; w <= maxWeek; w++) {
      const start = new Date(firstDate);
      start.setDate(start.getDate() + w * 7);
      const end = new Date(firstDate);
      end.setDate(end.getDate() + w * 7 + 6);
      const short = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
      const full = (d) => `${d.getMonth() + 1}月${d.getDate()}日`;
      list.push({
        week: w,
        id: `wk-${w}`,
        short: `${short(start)}-${short(end)}`,
        full: `${full(start)} - ${full(end)}`,
        current: w === currentWeek,
        stage: w <= 12 ? 'early' : (w <= 27 ? 'mid' : 'late'),
      });
    }
    return list;
  },

  // 点击孕周卡片，弹完整日期提示
  onWeekItemTap(e) {
    const w = e.currentTarget.dataset.week;
    const item = this.data.weekList.find((it) => it.week === w);
    if (item) {
      wx.showToast({ title: `孕${w}周：${item.full}`, icon: 'none' });
    }
  },

  // 计算检查建议
  calculateCheckItems(week, day) {
    const currentDay = week * 7 + day;
    const { completedChecks } = this.data;
    const firstDate = new Date(this.data.firstDay);

    // 计算日期范围：根据孕周起止算出具体日期
    const getDateRange = (weekStart, weekEnd) => {
      const start = new Date(firstDate);
      start.setDate(start.getDate() + weekStart * 7);
      const end = new Date(firstDate);
      end.setDate(end.getDate() + weekEnd * 7 + 6);
      const fmt = (d) => `${d.getMonth() + 1}月${d.getDate()}日`;
      return `${fmt(start)} - ${fmt(end)}`;
    };

    const allChecks = [
      {
        name: '确认怀孕检查（血HCG、孕酮）',
        weekStart: 4, weekEnd: 5,
        desc: '抽血确认是否怀孕及胚胎发育情况',
        required: true,
      },
      {
        name: 'B超检查（排除宫外孕）',
        weekStart: 5, weekEnd: 6,
        desc: '确认宫内妊娠，排除宫外孕',
        required: true,
      },
      {
        name: 'B超查胎心胎芽',
        weekStart: 6, weekEnd: 7,
        desc: '确认胚胎是否正常发育，一般在孕6-7周可见胎心胎芽',
        required: true,
      },
      {
        name: '建档检查（全面体检）',
        weekStart: 8, weekEnd: 12,
        desc: '血常规、尿常规、肝肾功能、传染病筛查（乙肝、梅毒、HIV等）、心电图',
        required: true,
      },
      {
        name: 'NT检查',
        weekStart: 11, weekEnd: 13,
        desc: '早期唐氏筛查，测量胎儿颈后透明层厚度，错过无法补做',
        required: true,
      },
      {
        name: '唐氏筛查（中期）',
        weekStart: 15, weekEnd: 20,
        desc: '抽血筛查唐氏综合征、爱德华氏综合征等。准确率约60-70%',
        required: false,
        optionalNote: '可选：如已做无创DNA可跳过',
      },
      {
        name: '无创DNA（NIPT）',
        weekStart: 12, weekEnd: 22,
        desc: '抽血筛查唐氏综合征，准确率99%以上',
        required: false,
        optionalNote: '可选：建议高龄（≥35岁）或唐筛高风险者做',
      },
      {
        name: '系统B超（大排畸）',
        weekStart: 20, weekEnd: 24,
        desc: '详细检查胎儿头、面、心脏、四肢、脊柱等各器官结构，非常重要',
        required: true,
      },
      {
        name: '糖耐量检查（OGTT）',
        weekStart: 24, weekEnd: 28,
        desc: '喝糖水后抽三次血，筛查妊娠期糖尿病',
        required: true,
      },
      {
        name: '小排畸B超',
        weekStart: 28, weekEnd: 32,
        desc: '评估胎儿生长发育情况、胎位、羊水量、胎盘位置',
        required: true,
      },
      {
        name: '胎心监护（NST）',
        weekStart: 34, weekEnd: 40,
        desc: '监测胎儿心率及宫缩情况，了解胎儿是否缺氧，通常每周一次',
        required: true,
      },
      {
        name: '产前全面检查',
        weekStart: 37, weekEnd: 40,
        desc: '评估骨盆条件、胎位、胎儿大小，确定分娩方式',
        required: true,
      },
    ];

    const currentItems = [];
    const upcomingItems = [];
    const overdueItems = [];
    const completedItems = [];

    for (const check of allChecks) {
      const isCompleted = completedChecks.indexOf(check.name) !== -1;
      const dateRange = getDateRange(check.weekStart, check.weekEnd);
      const item = {
        ...check,
        dateRange,
        completed: isCompleted,
      };

      if (isCompleted) {
        completedItems.push(item);
      } else if (currentDay >= check.weekStart * 7 && currentDay <= check.weekEnd * 7 + 6) {
        const daysLeft = check.weekEnd * 7 + 6 - currentDay;
        item.urgent = daysLeft <= 7;
        item.deadline = `还剩 ${daysLeft} 天`;
        currentItems.push(item);
      } else if (currentDay < check.weekStart * 7) {
        const daysToStart = check.weekStart * 7 - currentDay;
        item.urgent = false;
        item.deadline = `${daysToStart} 天后开始`;
        upcomingItems.push(item);
      } else if (currentDay > check.weekEnd * 7 + 6 && check.required) {
        // 必做但已过期
        const overdueDays = currentDay - (check.weekEnd * 7 + 6);
        item.urgent = true;
        item.deadline = `已过期 ${overdueDays} 天`;
        overdueItems.push(item);
      }
    }

    // 如果没有当前需做的检查，显示鼓励信息
    if (currentItems.length === 0 && upcomingItems.length === 0 && overdueItems.length === 0 && completedItems.length === 0) {
      if (currentDay > 280) {
        currentItems.push({
          name: '宝宝已经足月啦！',
          dateRange: '随时可能分娩',
          desc: '请准备好待产包，保持联系畅通，有临产征兆及时就医',
          urgent: true,
          deadline: '随时',
          completed: false,
        });
      } else if (currentDay < 28) {
        currentItems.push({
          name: '恭喜怀孕！',
          dateRange: '孕早期',
          desc: '注意补充叶酸，避免剧烈运动，保持良好心态',
          urgent: false,
          deadline: '',
          completed: false,
        });
      }
    }

    // 生成产检提醒横幅：过期未做 > 当前需做(紧急) > 即将到来(7天内)
    let alertBanner = null;
    if (overdueItems.length > 0) {
      const item = overdueItems[0];
      alertBanner = {
        type: 'overdue',
        icon: '⚠️',
        title: `${item.name}已过期`,
        sub: item.deadline + '，建议尽快补做',
      };
    } else if (currentItems.length > 0) {
      const urgent = currentItems.find((c) => c.urgent) || currentItems[0];
      alertBanner = {
        type: 'current',
        icon: urgent.urgent ? '⏰' : '📋',
        title: urgent.name,
        sub: urgent.deadline + '，本周建议完成',
      };
    } else if (upcomingItems.length > 0) {
      const soon = upcomingItems.find((c) => {
        const m = c.deadline.match(/(\d+)/);
        return m && parseInt(m[1], 10) <= 7;
      });
      if (soon) {
        alertBanner = {
          type: 'upcoming',
          icon: '📅',
          title: soon.name,
          sub: soon.deadline + '，可提前预约',
        };
      }
    }

    this.setData({
      checkItems: currentItems,
      upcomingChecks: upcomingItems,
      overdueChecks: overdueItems,
      completedChecksList: completedItems,
      alertBanner,
    });
  },

  // 关闭横幅（当天不再显示）
  dismissBanner() {
    this.setData({ bannerDismissed: true });
    const today = this.formatDate(new Date());
    try { wx.setStorageSync('pregnancy_banner_dismissed', today); } catch (e) {}
  },

  // 检查今天是否已关闭横幅
  checkBannerDismissed() {
    try {
      const dismissed = wx.getStorageSync('pregnancy_banner_dismissed') || '';
      if (dismissed === this.formatDate(new Date())) {
        this.setData({ bannerDismissed: true });
      }
    } catch (e) {}
  },

  // 点击横幅：滚动到产检表
  scrollToChecks() {
    wx.pageScrollTo({
      scrollTop: 9999,
      duration: 300,
    });
  },

  // 折叠/展开产检分组
  toggleGroup(e) {
    const group = e.currentTarget.dataset.group;
    const key = `expandedGroups.${group}`;
    this.setData({
      [key]: !this.data.expandedGroups[group],
    });
  },

  // ========== Hero 卡片彩蛋 ==========

  // 点击 hero 卡片空白处触发彩蛋
  onHeroTap() {
    // 如果上一个动画还在跑，先停掉
    if (this._eggAnim) {
      clearInterval(this._eggAnim);
      this._eggAnim = null;
    }
    clearTimeout(this._eggTimer);

    const quotes = [
      '妈妈我又长大了一点点～',
      '嘿嘿，我在里面很乖哦',
      '妈妈的肚皮好温暖呀',
      '今天妈妈辛苦啦，抱抱～',
      '我在努力长胖胖，等我出来哦',
      '听到妈妈的声音啦，开心！',
      '妈妈吃了好吃的，我也尝到了呢',
      '今天有没有想我呀？',
      '我在这边偷偷打哈欠～',
      '妈妈的每一次心跳我都听得到',
    ];
    const tips = [
      `你知道吗？宝宝这周${this.data.babySize.develop || '在悄悄长大'}`,
      `宝宝现在像一颗${this.data.babySize.size || '小宝贝'}`,
      `孕${this.data.pregnancyInfo.week}周啦，离预产期还有${this.data.pregnancyInfo.remainingDays}天`,
      '孕期保持好心情，宝宝也能感受到哦',
      '每天和宝宝说说话，ta 能听到的',
    ];
    const useQuote = Math.random() < 0.5;
    const text = useQuote
      ? quotes[Math.floor(Math.random() * quotes.length)]
      : tips[Math.floor(Math.random() * tips.length)];
    const kick = useQuote && Math.random() < 0.4;

    // 重置气泡
    this.setData({ eggVisible: false, eggText: text, eggKick: kick, eggBurst: false, eggStyle: '' }, () => {
      this.setData({ eggVisible: true });
      if (kick) wx.vibrateShort({ type: 'medium' });
      this.startEggAnim();
    });
  },

  // JS 正弦曲线驱动气泡上飘
  startEggAnim() {
    const DURATION = 5000; // 总时长 ms
    const RISE = 420;      // 总上升 rpx（限制在卡片内）
    const SWING = 30;      // 左右摆幅 rpx（±）
    const SWING_FREQ = 2.2; // 摆动频率（越低摆越慢）
    const startTime = Date.now();

    this._eggAnim = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const t = elapsed / DURATION; // 0 → 1

      if (t >= 1) {
        clearInterval(this._eggAnim);
        this._eggAnim = null;
        this.setData({ eggVisible: false, eggKick: false, eggBurst: false });
        return;
      }

      // 上升：前 70% 上升到顶部，之后悬停
      const RISE_END = 0.7;
      const easeT = 1 - Math.pow(1 - Math.min(t / RISE_END, 1), 1.8);
      const y = -RISE * easeT;

      // 左右摆动：上升到顶部时摆动，悬停时也微摆
      const x = Math.sin(t * Math.PI * 2 * SWING_FREQ) * SWING;

      // 缩放：前 8% 快速放大到 1，之后缓慢到 1.15，破裂时急速膨胀
      let scale;
      if (t < 0.08) {
        scale = 0.3 + 0.7 * (t / 0.08);
      } else if (t < 0.82) {
        scale = 1.0 + 0.15 * ((t - 0.08) / 0.74);
      } else {
        // 破裂阶段：急速膨胀
        scale = 1.15 + 0.5 * ((t - 0.82) / 0.18);
      }

      // 透明度：前 6% 浮现，悬停保持，82%后破裂渐隐
      let opacity;
      if (t < 0.06) opacity = t / 0.06;
      else if (t < 0.82) opacity = 1;
      else opacity = 1 - (t - 0.82) / 0.18;

      this.setData({
        eggStyle: `transform: translate(calc(-50% + ${x}rpx), ${y}rpx) scale(${scale}); opacity: ${opacity};`,
        eggBurst: t >= 0.82,
      });
    }, 16); // ~60fps
  },

  // 标记检查为已完成/未完成
  toggleCheckItem(e) {
    const { name } = e.currentTarget.dataset;
    let { completedChecks } = this.data;
    const idx = completedChecks.indexOf(name);

    if (idx !== -1) {
      completedChecks.splice(idx, 1);
      wx.showToast({ title: '已取消完成', icon: 'none' });
    } else {
      completedChecks.push(name);
      wx.showToast({ title: '标记为已完成 ✓', icon: 'success' });
    }

    this.setData({ completedChecks });
    this.calculatePregnancyInfo();

    // 保存到云端
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'saveCompletedChecks', completedChecks },
    }).catch(() => {
      // 云端保存失败则存本地
      wx.setStorageSync('pregnancy_completed_checks', completedChecks);
    });
  },

  // 意见反馈：打开抽屉
  showFeedback() {
    this.setData({
      showFeedbackSheet: true,
      feedbackText: '',
      selectedTagIndex: -1,
      feedbackSubmitting: false,
    });
  },

  // 关闭反馈抽屉
  closeFeedbackSheet() {
    this.setData({ showFeedbackSheet: false });
  },

  // 阻止冒泡
  noop() {},

  // 选择反馈类型标签
  onSelectFeedbackTag(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({
      selectedTagIndex: this.data.selectedTagIndex === idx ? -1 : idx,
    });
  },

  // 反馈内容输入
  onFeedbackInput(e) {
    this.setData({ feedbackText: e.detail.value });
  },

  // 提交反馈
  submitFeedback() {
    const { feedbackText, feedbackTags, selectedTagIndex, feedbackSubmitting } = this.data;
    if (feedbackSubmitting) return;

    const text = (feedbackText || '').trim();
    if (!text) {
      wx.showToast({ title: '请输入反馈内容', icon: 'none' });
      return;
    }

    // 拼接类型标签
    const tag = selectedTagIndex >= 0 ? feedbackTags[selectedTagIndex].label : '';
    const feedback = tag ? `${tag}｜${text}` : text;

    // 保存到本地历史
    try {
      const history = wx.getStorageSync('pregnancy_feedback_history') || [];
      history.push({
        content: feedback,
        time: this.formatDate(new Date()) + ' ' +
          String(new Date().getHours()).padStart(2, '0') + ':' +
          String(new Date().getMinutes()).padStart(2, '0'),
      });
      wx.setStorageSync('pregnancy_feedback_history', history);
    } catch (err) {}

    this.setData({ feedbackSubmitting: true });

    // 保存到云端
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'saveFeedback', feedback },
    }).then(() => {
      this.setData({ showFeedbackSheet: false, feedbackSubmitting: false });
      wx.showToast({ title: '感谢你的反馈！', icon: 'success' });
    }).catch(() => {
      this.setData({ showFeedbackSheet: false, feedbackSubmitting: false });
      wx.showToast({ title: '反馈已保存', icon: 'success' });
    });
  },

  onShareAppMessage() {
    const w = this.data.pregnancyInfo.week;
    const baby = this.data.babySize.size || '小宝贝';
    return {
      title: `🌸 好孕日记 · 孕${w}周，宝宝像${baby}`,
      path: '/pages/home/home',
    };
  },

  // 重置日期
  resetDate() {
    wx.showModal({
      title: '确认重置',
      content: '重置后所有孕期数据将被清除，确定要重置吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '重置中...' });
          wx.cloud.callFunction({
            name: 'quickstartFunctions',
            data: { type: 'deleteUserData' },
          }).catch(() => {});
          wx.removeStorageSync('pregnancy_first_day');
          wx.removeStorageSync('pregnancy_completed_checks');
          wx.removeStorageSync('pregnancy_user_name');
          this.setData({
            firstDay: '',
            userName: '',
            hasStarted: false,
            lastUpdateTime: '',
            pregnancyInfo: {
              week: 0, day: 0, elapsedDays: 0,
              remainingDays: 280, progress: 0,
              dueDate: '', period: '',
            },
            checkItems: [],
            upcomingChecks: [],
            overdueChecks: [],
            completedChecksList: [],
            completedChecks: [],
            babySize: { size: '', emoji: '', desc: '' },
            weekList: [],
            scrollWeekId: '',
          });
          wx.hideLoading();
          wx.showToast({ title: '已重置', icon: 'success' });
        }
      },
    });
  },
});
