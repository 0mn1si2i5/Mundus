# Implementation status

本文只记录当前实施切片；稳定的产品与架构决策仍以 [PROJECT_PLAN.md](PROJECT_PLAN.md) 为准。

## 阶段 1：完成，保留一项非阻塞验证

- [x] 工程、设计令牌、双语、CI 与基础 WebGL 地球
- [x] Natural Earth 110m 数据清单、国家纹理与稳定 `countryId`
- [x] 国家 hover、选择和海洋降级
- [x] URL 模式/坐标往返与非法参数回退
- [x] WebGL context loss 状态、恢复与 GPU 资源释放
- [x] 桌面、移动端浏览器冒烟与构建体积基线
- [x] 桌面 45–60fps 真实硬件采样（60.0fps，p95 17.5ms）
- [x] 实体手机 `low` 画质采样（iPhone 17：60.0fps，p95 17.0ms）
- [ ] 中档手机 30fps 的真实硬件采样（无可用设备，保留计划，不阻塞后续开发）

当前构建基线：App Shell 约 18 kB gzip；完整首屏模块约 375 kB gzip。Three.js、R3F 和地理数据各自独立缓存。真实 FPS 不使用无头浏览器结果代替，需在目标设备上采样后关闭阶段门槛。

采样证据见 [桌面报告](performance/2026-07-14-desktop.md) 与 [iPhone 17 报告](performance/2026-07-14-iphone-17.md)。

## 当前：阶段 2 · Other Side

- [x] 版本化模式契约和编译期注册
- [x] 地球点击、坐标输入、本地城市搜索、精选示例与主动定位
- [x] 对跖计算、地心连线、镜头翻转、地心/表面距离
- [x] 起点和对跖点国家/海洋结果
- [x] 分享 URL 与精确/约略坐标选择
- [x] Natural Earth 50m populated places 可复现索引与最近收录聚居点
- [ ] 完整键盘地球控制、焦点管理和移动端底部抽屉打磨
- [ ] 阶段 2 性能回归与发布级视觉验收
