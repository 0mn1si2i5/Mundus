# Mundus

[English](README.md)

Mundus 是一个用三种科学视角观察同一颗行星的交互式三维地球。它被设计为一件小型数字博物馆展品：容易上手，明确说明方法，也诚实呈现数据边界。

产品仍有意限制为三个模式。当前检出内容是尚未发布的 **V1.1.0 Parchment Atlas（羊皮纸图集）**候选版本：

- **地球另一端（Other Side）**：计算精确起点与对跖点，并分别显示捆绑 GeoNames 快照中距两端最近的符合条件主要城市。结果是收录主要城市，不代表最近聚居地、行政边界或建成区。
- **拆解发展（Development, Unpacked）**：使用联合国开发计划署《2025 年人类发展报告》数据，对照已发布 HDI 与本项目计算的健康、教育、收入维度指数。
- **日照线（Sunline）**：以 UTC 展示昼夜分界，并估算太阳位置、日出和日落；结果仅用于教育展示。

经过验证的公开 **V1.0.0** 站点为 <https://0mn1si2i5.github.io/Mundus/>，对应提交 `a5ff99bc60fb7cd2e6e14f4d3bc4f54e5abfb4a1`。该站点早于当前检出内容中的羊皮纸视觉、GeoNames 双侧城市关系与 Natural Earth 矢量地球；这些候选能力只有在另行获得发布授权并通过桌面/移动线上验证后才属于公开站点。

## 本地运行

需要 Node.js 22 或更高版本，以及 pnpm 11.7.0。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

提交修改前运行完整本地门槛：

```bash
pnpm check
pnpm test:e2e
```

`pnpm check` 会检查格式、lint、类型、生成数据完整性、单元测试和生产构建。V1 的公开生产产物明确不发布 source map。

本地候选使用可复现生成的 Natural Earth 矢量球面：低画质加载 110m，中/高画质加载 50m；国家颜色来自小型调色板纹理，原有栅格地球继续作为加载与失败回退。

## 数据与许可证

仓库中的 MIT License 只覆盖 Mundus 源代码。内置数据集和第三方软件包继续适用各自的条款。数据版本、转换、署名和局限见[数据来源](DATA_SOURCES.md)，依赖与数据许可证清单见[第三方许可证](THIRD_PARTY_LICENSES.md)。

Natural Earth 边界是制图表达，不是领土状态的法律权威。UNDP 与太阳计算结果属于教育性解释，不得作为法律、航海或工程依据。

## 仓库结构

```text
src/
  app/           应用外壳与响应式布局
  data/          数据清单、生成快照与注册表
  features/      地球内核与按领域组织的观察模式
  i18n/          中英文界面文案
  state/         小型跨功能状态
  styles/        全局令牌与基础样式
  test/          单元测试环境
tests/e2e/       真实浏览器发布检查
docs/            产品决策与实施证据
```

安全问题请按 [SECURITY.md](SECURITY.md) 私密报告。
