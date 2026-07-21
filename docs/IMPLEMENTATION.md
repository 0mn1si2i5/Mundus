# Implementation status

本文只记录当前实施切片；稳定的产品与架构决策仍以 [PROJECT_PLAN.md](PROJECT_PLAN.md) 为准。

当前执行目标、批次门槛和审阅循环见 [EXECUTION_PLAN.md](EXECUTION_PLAN.md)。

## Natural Earth 完整矢量球面

- [x] 110m/50m 固定源文件、SHA-256、许可与可复现离线转换
- [x] 单一合并国家表面、单一海岸线、单一内部共享边界与稳定国家调色板索引
- [x] low 懒加载 110m，medium/high 懒加载 50m；加载/失败保留原栅格球面
- [x] Development 指标/年份只更新 RGBA 调色板，不重建几何
- [x] CPU 国家拾取、Other Side 拖拽剖面、Sunline 遮罩、标记、弧线、经纬网与 context restore 保持原路径
- [x] 50m 产物 1,346,186 bytes gzip，实测上传属性与固定 905×4 调色板 GPU 8,950,732 bytes；低档 110m 为 793,168 bytes
- [x] 四点面内采样、传输量化回读与边界自适应细分将全局丢弃候选面积限制为 110m 0.00417%、50m 0.000149%
- [x] 独立源面积门槛识别并修复 50m 南极环顺序问题：南极由 0.00473 sr 恢复到约 0.30196 sr；50m 总源/输出面积差由 8.22% 降为 0.000149%
- [x] 拖拽时海洋壳提供统一 0.76 有效透明度，陆地填色不再叠加 alpha；海岸线/国界降透明度保留定位线索
- [x] Sunline 使用同一合并表面增加夜幕之上的所选国家高亮 pass；常态矢量层实测 4 draw，Sunline 所选国家时 5 draw
- [x] 解码前严格校验版本、完整 stream schema、国家/调色板索引、文件与解码预算；生成集通过同目录 staging/backup 与 manifest-last 回滚发布

正式转换契约、正确性夹具和资源预算见 [DATA_SOURCES.md](../DATA_SOURCES.md)、
`scripts/build-natural-earth-vector-globe.test.mjs` 与对应 manifest。无头帧间隔不代表
实体设备性能；本次没有可用实体硬件，medium/high 50m 的实体手机/桌面采样仍是
后续发布验证项。

## V1 MVP 发布：首次 Pages 部署已验证，最终发布证据待合并

- [x] 阶段 1–4 私有基线完成三方审阅、纠错复验与远端 CI 同步
- [x] 一次性首次操作提示与 Mode Atlas
- [x] 右上 Mode Atlas 与三模式底部直达导航
- [x] Development 全球中位数、相对中位数与历史变化
- [x] Development 同年相近 HDI 的结构对照叙事
- [x] V1 产品收口分支通过审阅并由 PR #1 合并到 `main`
- [x] 最小公开发布文档、安全策略、数据来源与许可证清单由 PR #2 合并
- [x] GitHub Pages 构建、产物验证、部署与线上冒烟路径已在 PR #3 实现并通过远端演练
- [x] PR #3 通过发布审阅并合并到 `main`
- [x] 仓库已公开，Pages、`main` 保护和私密漏洞报告已启用
- [x] 首次 Pages 部署和桌面/移动自动线上冒烟通过
- [ ] 合并最终证据 PR，再次部署验证并创建 `v1.0.0` 与 GitHub Release

2026-07-20 合并前历史检查点：私有 `main` 位于 `fc0ce78`；当前分支
`codex/v1-pages-release` 位于 `5c8fb25`。PR #3 可合并，远端 `quality`、
`browser-smoke` 与 `pages-artifact` 均通过，PR 上的部署和线上冒烟按设计
跳过。当时仓库尚未启用 Pages，`main` 尚未保护，也尚无 V1 标签或 Release；
该状态已经由下方首次公开部署证据取代。
本地复验为 66 个单元测试通过；完整 Playwright 为 45 项通过、3 项按设计
跳过；Pages 产物为 22 个文件、0 个 source map。

2026-07-20 首次公开部署证据：PR #3 合并提交为
`40c4ab2fdc7ff570924ff5f5c9ed6b024b7a1a77`。该提交的
[CI](https://github.com/0mn1si2i5/Mundus/actions/runs/29722665105) 与
[Pages](https://github.com/0mn1si2i5/Mundus/actions/runs/29722665114) 均通过；
`pages-artifact`、`deploy-pages` 和桌面/移动 `live-smoke` 完整成功。线上地址
为 <https://0mn1si2i5.github.io/Mundus/>，HTTPS 请求返回 200 和预期文档
标题。最终标签必须等待本证据变更合并后的同 SHA 部署再次通过。

零上下文执行线程必须先阅读仓库根目录的 [AGENTS.md](../AGENTS.md)，然后按
[MVP_RELEASE_PLAN.md](MVP_RELEASE_PLAN.md) 与
[RELEASE_RUNBOOK.md](RELEASE_RUNBOOK.md) 完成剩余发布闭环。

基线检查点为私有 `main` 的 `1d627e6`：本地 57 个单元测试、31 个浏览器测试通过（1 个桌面专属生命周期用例在移动项目按设计跳过），远端 quality 与 browser-smoke 均通过。公开发布仍以执行计划中的产品、安全、许可和部署门槛为准。

2026-07-15 的产品收口停止检查点已经由后续 PR #1 和 PR #2 取代；保留其
测试数字仅作为历史证据，不再作为当前执行状态。

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

采样证据见 [桌面报告](performance/2026-07-14-desktop.md)、[iPhone 17 报告](performance/2026-07-14-iphone-17.md) 与 [阶段 2 回归](performance/2026-07-14-stage-2.md)。

## 阶段 2 · Other Side：完成

- [x] 版本化模式契约和编译期注册
- [x] 地球点击、坐标输入、GeoNames 双语主要城市搜索、精选示例与主动定位
- [x] GeoNames 2026-07-21 固定快照、CC BY 4.0 署名、OpenCC 构建期繁转简与懒加载索引
- [x] 对跖计算、地心连线、镜头翻转、地心/表面距离
- [x] 起点和对跖点国家/海洋结果
- [x] 分享 URL 与精确/约略坐标选择
- [x] GeoNames 双侧最近符合条件主要城市关系、端点距离、短测地线与形状标记；旧 Natural Earth populated-places 管线已完整移除
- [x] 键盘地球旋转/缩放/选择、对话框焦点管理和移动端抽屉语义
- [x] 阶段 2 性能回归与桌面/移动发布级视觉验收

## 阶段 3 · Development, Unpacked：完成

- [x] UNDP HDR 2025 固定版本获取、校验、转换与数据质量检查
- [x] 1990–2023 HDI/健康/教育/收入规范化快照与 Natural Earth 显式连接
- [x] 国家着色、指标切换、时间轴、图例与结果卡
- [x] 同步排序表格、来源和方法界面
- [x] 阶段 3 性能回归与发布级视觉验收

数据方法见 [UNDP HDR 2025](data/undp-hdr-2025.md)，发布回归见 [阶段 3 性能报告](performance/2026-07-14-stage-3.md)。

## 阶段 4 · Sunline 与整体收口：完成

- [x] NOAA / Meeus 太阳赤纬、均时差、直射点和太阳高度纯计算
- [x] 2000–2099 分钟级 UTC 时间状态、实时/固定语义与版本化分享 URL
- [x] 独立昼夜 shader、0° 至 -6° 晨昏带、太阳方向光与直射点
- [x] 赤道、南北回归线和南北极圈辅助线
- [x] 日期、24 小时时间轴、1440× 播放/暂停和回到此刻
- [x] 地点太阳高度、昼夜状态、近似日出日落与极昼极夜结果
- [x] 双语方法说明、移动端折叠抽屉、减少动态效果与模式转场
- [x] 固定时间视觉回归、连续模式切换和桌面/移动发布回归

太阳计算只用于教育互动展示，不作为法律、航海或工程时间服务。阶段 4 构建与性能证据见 [Sunline 发布回归](performance/2026-07-14-stage-4.md)。中档手机真实硬件采样仍按阶段 1 的非阻塞验证计划保留。
