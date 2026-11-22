# PyQuest CH16–CH29 补全计划

> 依据 [pystay/python-pyquest](https://github.com/pystay/python-pyquest) 现有 `questions/`、`generator/framework.py`、`generator/validate.py`，以及 [walter201230/Python](https://github.com/walter201230/Python) 开源教程目录。以下标题是 **本仓库扩展建议**，不是宣称原作者已发布的 CH16–CH29 官方标题。

## 基线

- 已完成 CH01–CH15，15 章 **1780** 题。CH02 目前为 100 道，其余大多数章节为 120 道。
- 待增加 CH16–CH29，共 **14** 章。若每章 120 道，新增 1680 道，最终总量 **3460** 道。
- 每章按 **E/M/H/X 四档 × 各 30 题**，保持十字段：id、topic、difficulty、stars、description、code_template、expected_output、hints、test_cases、solution。
- 题目由新编写的实践任务组成，不直接照搬原教程正文；教程原文依 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 引用、署名。

## 章节提案

| 章号 | 拟定主题 | 对应教程 | 实践范围 |
|---|---|---|---|
| CH16 | 迭代、推导式与生成器 | [python7](https://github.com/walter201230/Python/tree/master/Article/PythonBasis/python7) | 迭代协议、enumerate/zip、生成器、惰性计算 |
| CH17 | 面向对象基础 | [python8](https://github.com/walter201230/Python/tree/master/Article/PythonBasis/python8) | 类、实例、构造、属性、方法 |
| CH18 | 继承、组合与多态 | [python8](https://github.com/walter201230/Python/tree/master/Article/PythonBasis/python8) | 继承、super、覆盖、组合、多态 |
| CH19 | 模块、包与导入 | [python9](https://github.com/walter201230/Python/tree/master/Article/PythonBasis/python9) | import、模块作用域、组织与复用 |
| CH20 | 魔术方法与容器协议 | [python10](https://github.com/walter201230/Python/tree/master/Article/PythonBasis/python10) | __str__、__repr__、__len__、__iter__、比较与运算 |
| CH21 | 闭包与装饰器 | [python15](https://github.com/walter201230/Python/tree/master/Article/PythonBasis/python15)、[python16](https://github.com/walter201230/Python/tree/master/Article/PythonBasis/python16) | nonlocal、函数装饰器、wraps |
| CH22 | 异常与上下文管理器 | [python19](https://github.com/walter201230/Python/tree/master/Article/PythonBasis/python19)、[python21](https://github.com/walter201230/Python/tree/master/Article/PythonBasis/python21) | try/except/finally、自定义异常、with |
| CH23 | 正则表达式 | [python14](https://github.com/walter201230/Python/tree/master/Article/PythonBasis/python14) | match/search、分组、替换、查找 |
| CH24 | 枚举与元类初步 | [python11](https://github.com/walter201230/Python/tree/master/Article/PythonBasis/python11)、[python12](https://github.com/walter201230/Python/tree/master/Article/PythonBasis/python12) | Enum、type、类创建机制 |
| CH25 | pathlib 与文件处理 | [python18](https://github.com/walter201230/Python/tree/master/Article/PythonBasis/python18) | 路径拼装、扩展名、目录遍历；文件题采用浏览器支持的内存操作 |
| CH26 | 类型注解与数据类 | [python17](https://github.com/walter201230/Python/tree/master/Article/PythonBasis/python17)、[python20](https://github.com/walter201230/Python/tree/master/Article/PythonBasis/python20) | 注解、dataclass、default_factory、输入校验 |
| CH27 | 异步与并发基础 | [python13](https://github.com/walter201230/Python/tree/master/Article/PythonBasis/python13)、[python22](https://github.com/walter201230/Python/tree/master/Article/PythonBasis/python22) | async/await、任务调度、并发限制；不依赖浏览器不支持的多进程 |
| CH28 | pytest、logging 与工程规范 | [python23–26](https://github.com/walter201230/Python/tree/master/Article/PythonBasis) | 断言、测试设计、日志、代码风格、pyproject 概念 |
| CH29 | 包装发布与综合项目 | [python27–28](https://github.com/walter201230/Python/tree/master/Article/PythonBasis) | CLI 数据处理、模块化项目、综合算法 |

## 质量门槛

1. 所有题目使用 PyQuest 实际 JSON 结构，题号连续且唯一；solution 可由 Python 执行，test_cases 可通过。
2. 逐章生成后运行 `python generator/validate.py`，检验四档文件、唯一输出、字段完整、标准答案及断言。
3. `python generator/sync_site.py` 同步到 `docs/data/questions/` 和 `docs/data/index.json`，再运行 Chromium + Pyodide 浏览器验收。
4. 高难度题不仅换数字，还应包含组合知识点、边界情况、算法流程；在交付前进行人工抽检。
5. 不覆盖原有章节、保留已保存的答题数据；在独立 PR 中审核，不直接发布到 master。

## 来源与署名

- [PyQuest](https://github.com/pystay/python-pyquest) — 原始题库架构，MIT License。
- [小白学 Python](https://github.com/walter201230/Python) — 对齐的公开教程，CC BY 4.0。
- 新增题目的题干、答案及程序由本项目编写，未复制教程站点的交互代码。

## 2026-11-23 扩展实施记录

- CH17–CH29 已按上述**项目拟定主题**生成：13 × 120 = 1560 道；连同先前 CH16 共新增 1680 道。
- 题库总量 29 章、3460 道（CH02 仅 100 道），与一律每章 120 道的理想规划不同。
- 题目配方：每章四档，每档五个知识目标，每个目标六组输入参数。每道附带标准答案、提示和输出断言；并通过 Python 逐题执行校验。
- CH27 避免浏览器环境不适合的多进程和长时间事件循环，集中训练协程声明、await 依赖、执行状态与生成器模拟调度；完整异步程序需要另外在 Python 本地环境练习。
- CH28/29 涉及 pytest、Pydantic、uv、ruff、typer 的知识点属于工程学习建议；本批实际可执行题目使用标准库 unittest、mock、logging、dataclasses、argparse 等，避免要求加载未安装的外部库。
- 通过 CI、网页题目索引与 Pyodide 抽样验收后，作为 Draft PR 提交审查；正式站点仍然保持 master 版本，未发布此批新增题库。
