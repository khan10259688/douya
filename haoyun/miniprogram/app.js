App({
  globalData: {
    env: 'cloudbase-d9g1ba0np7d624b4a', // 云环境ID，请替换为实际环境ID
  },
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }
  },
});
