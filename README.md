# 空间棋 AI · Prototype 09

这是一个以“落子”方式生成卧室、客厅家具布局的前端原型。页面在离散网格上生成候选点，执行碰撞、功能区和通行约束检查，再用 Beam Search 保留较优的中间状态并输出多套方案。

当前实现以浏览器端排布引擎为核心，FastAPI 只负责静态页面、户型识别代理和全局家具配置持久化。

## 快速启动

在项目目录运行：

```powershell
python floorplan_api.py
```

开发时自动重载：

```powershell
uvicorn floorplan_api:app --host 127.0.0.1 --port 8765 --reload
```

打开：

- 主页面：<http://127.0.0.1:8765/bedroom-space-chess-V3.html>
- 家具偏好配置：<http://127.0.0.1:8765/furniture-rule-editor.html>
- 健康检查：<http://127.0.0.1:8765/health>

直接双击 HTML 只能使用不依赖后端的部分功能。户型识别、示例 JSON 和全局配置保存请通过 FastAPI 地址访问。

## 目录结构

```text
排布下棋/
├─ bedroom-space-chess-V3.html       # 主页面结构与控件（轻量入口）
├─ furniture-rule-editor.html        # 配置中心页面结构（轻量入口）
├─ assets/
│  ├─ css/
│  │  ├─ space-chess.css             # 主页面、棋盘和搜索树样式
│  │  └─ furniture-rule-editor.css   # 配置中心样式
│  └─ js/
│     ├─ space-chess.js              # 候选生成、约束、评分、Beam 搜索和可视化
│     └─ furniture-rule-editor.js    # 家具库、房间落子清单和规则编辑交互
├─ floorplan_api.py                  # FastAPI 静态服务、识别代理、全局配置 API
├─ server_config/
│  ├─ furniture-config-default.json  # 服务端基础默认配置
│  └─ furniture-config-current.json  # 网页修改后生效的唯一全局配置
├─ samples/                          # 户型示例图片及缓存识别 JSON
├─ test_layout_baseline.js           # 基础房型/配置回归
└─ test_layout_stress.js             # 多尺寸、多轮搜索压力回归
```

## 代码职责

### `assets/js/space-chess.js`

主排布引擎。目前仍作为一个兼容性优先的浏览器脚本，内部职责包括：

1. 房间轮廓、门窗与网格构建。
2. 家具尺寸模数和沿墙、相对家具、活动区候选采样。
3. Bitset/栅格碰撞、硬功能区、软功能区和通行区判断。
4. 局部评分、累计评分、同构去重和 Beam 截断。
5. 对象关系、地面死角/平衡、墙面缝隙/角落收口的联合评价。
6. 最终方案筛选、A/B/C 卡片和可逐节点折叠的完整搜索树渲染。
7. 户型识别结果载入、房间尺寸调整和交互控制。

排布算法问题优先只读取这个文件，不需要再读取两个完整 HTML。

### `assets/js/furniture-rule-editor.js`

只负责配置中心：家具物品库、候选规则列表、尺寸/数量/使用区、房间独立落子顺序、实时预览、导入导出和服务端自动保存。

配置页面问题优先读取这个文件和相应 JSON，不需要加载主排布引擎。

### `floorplan_api.py`

提供：

- `/assets`、`/samples` 静态资源；
- `/api/upload`、`/api/recognize` 户型识别转发；
- `/api/furniture-config` 唯一全局配置读写；
- `/api/furniture-config/default` 基础默认配置；
- `/api/furniture-config/restore` 恢复默认配置。

## 配置约定

主页面与配置中心都只读取 `/api/furniture-config` 对应的 `furniture-config-current.json`。`furniture-config-default.json` 仅是人工点击“恢复基础配置”时使用的回滚快照，打开页面不会用它覆盖 current。

布置丰满度当前只开放“丰富”模式；“疏朗 / 标准”在界面灰化，导入旧配置时也会统一按丰富模式运行。

浏览器 Cookie/本地存储不作为配置真相源。服务端 current 是唯一运行配置；配置缺项时引擎停止并报错，不再悄悄套 JS 默认参数。

配置中心分为三个板块：

- `家具物品库`：尺寸模数、相对家具、距离、朝向、使用区、沿墙连续柜体；
- `房间落子清单`：房间引用哪些家具、最少/最多数量和优先级；
- `全局约束`：地面/墙面评分、0.5m 通行、零孤岛、丰富度、面积模组、设计语法、搜索预算和末轮填缝。

运行时代码只保留多边形、碰撞、候选生成、搜索和评分计算过程。所有可调整的数据阈值从上述 current 配置读取。同类家具的不同模数写在 `geometry.variants`，是否进入尺寸搜索由 `geometry.searchVariants` 明确控制。

房间类型的家具落子清单相互独立。目前重点维护：

- `bedroom`：床优先，其后是床头柜、衣柜、书桌/工作椅、床尾凳、活动区小件和填缝柜；
- `living_room`：沙发与电视关系优先，其后是茶几、边几、单椅/小沙发、活动区和沿墙柜体。

## 回归测试

修改候选生成、评分、数量跳过、Beam 搜索或配置后至少运行：

```powershell
node test_layout_baseline.js
node test_layout_stress.js
node tests/config_contract_test.js
node tests/layout_quality_benchmark.js --assert-quality
node tests/recognized_room_suite.js --assert-quality --assert-speed
python -m py_compile floorplan_api.py
```

上述回归默认读取实际生效的 `furniture-config-current.json`。如需验证另一份配置，显式设置 `ROOM_CHESS_CONFIG=/absolute/path/to/config.json`，测试不会再悄悄改用 default。

两阶段改进目标见 [`docs/codex-layout-goal.md`](docs/codex-layout-goal.md)，设计距离与资料来源见 [`docs/design-rules-sources.md`](docs/design-rules-sources.md)。7 张卧室/融合客厅俯视参考图提炼出的配置、局部评分和全局评分建议见 [`docs/designer-top-view-layout-patterns.md`](docs/designer-top-view-layout-patterns.md)。

还应在浏览器检查：

1. 卧室、客厅及矩形/L 形/凹槽房型都能生成方案。
2. 搜索树“全部展开”能看到真实终止节点和未进入下一回合的原因。
3. 配置中心改动会自动保存，并在主页面刷新后生效。
4. 所有户型识别样例的单次完整搜索必须不超过 2 秒；压力用例超限时先检查候选上限和 Beam 宽度。

## 减少 Codex 上下文的使用方式

页面结构、样式和逻辑已经分离。后续提问时可以直接指定问题范围：

- “只检查候选生成/评分/Beam 搜索” → `assets/js/space-chess.js`
- “只改家具配置编辑器” → `assets/js/furniture-rule-editor.js`
- “只改界面样式” → `assets/css/` 下对应文件
- “只改识别接口或配置保存” → `floorplan_api.py`
- “只调默认家具参数” → `server_config/furniture-config-default.json`

这样新任务通常无需重新读取两个超大 HTML，也不需要附带大量旧截图。已经存在于当前对话中的历史不会自动删除；当一个阶段稳定后，新开任务并引用本 README 和具体文件，响应会更聚焦。

## 维护原则

- HTML 只保留语义结构与资源引用，不再把大段 CSS/JavaScript 写回页面。
- 默认配置与当前全局配置职责分离，不创建隐藏的浏览器配置副本。
- 新增约束优先配置化；确实属于通用几何/搜索能力时才写入引擎函数。
- 规则归属与迁移边界见 [`docs/layout-rule-ownership.md`](docs/layout-rule-ownership.md)。
- 性能优化以减少候选数、批量栅格判断、分层去重和合理 Beam 宽度为主。
- 每次修改算法后保留终止原因和搜索树记录，避免只看到“分支消失”。
