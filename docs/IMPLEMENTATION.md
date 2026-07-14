# Implementation status

本文只记录当前实施切片；稳定的产品与架构决策仍以 [PROJECT_PLAN.md](PROJECT_PLAN.md) 为准。

## 当前：阶段 1 收尾

- [x] 工程、设计令牌、双语、CI 与基础 WebGL 地球
- [x] Natural Earth 110m 数据清单、国家纹理与稳定 `countryId`
- [x] 国家 hover、选择和海洋降级
- [x] URL 模式/坐标往返与非法参数回退
- [x] WebGL context loss 状态、恢复与 GPU 资源释放
- [x] 桌面、移动端浏览器冒烟与构建体积基线
- [x] 桌面 45–60fps 真实硬件采样（60.0fps，p95 17.5ms）
- [ ] 中档手机 30fps 的真实硬件采样

当前构建基线：App Shell 约 18 kB gzip；完整首屏模块约 375 kB gzip。Three.js、R3F 和地理数据各自独立缓存。真实 FPS 不使用无头浏览器结果代替，需在目标设备上采样后关闭阶段门槛。

桌面采样证据见 [performance/2026-07-14-desktop.md](performance/2026-07-14-desktop.md)。

阶段完成后进入 Other Side：模式运行时、坐标输入、本地城市搜索、定位、地心连线、镜头转场和分享。
