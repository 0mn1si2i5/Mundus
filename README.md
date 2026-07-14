# Mundus

Mundus 是一个“数字博物馆展品 × 科学仪器 × 互动图鉴”式的三维地球实验室。每个模式都是一副重新观察地球的镜片。

当前正在实施 V1 的基础技术纵切。完整产品范围与架构决策见 [项目计划](docs/PROJECT_PLAN.md)，当前切片见 [实施状态](docs/IMPLEMENTATION.md)。

## 开发

需要 Node.js 22+ 与 pnpm 11。

```bash
pnpm install
pnpm dev
```

提交前运行：

```bash
pnpm check
pnpm test:e2e
```

## 结构

```text
src/
  app/           应用外壳与响应式布局
  data/          数据清单、许可与注册表
  features/      按领域组织的地球内核与观察模式
  i18n/          中英文案
  state/         小型跨功能状态
  styles/        全局令牌与基础样式
  test/          测试环境
tests/e2e/       真实浏览器冒烟测试
docs/            产品计划与长期文档
```

代码使用 MIT License。数据与素材遵循各自许可证；进入仓库前必须记录来源、版本、处理方法与再分发许可。
