# Prompt Optimizer with AxMiPRO

一个使用 AxMiPRO 优化器进行提示词优化的 Web 应用。

## 功能特性

- ✍️ 支持 Markdown 语法的初始提示词编辑器
- 📝 Signatures 编辑器,用于指定优化签名/规则
- 📁 支持上传图片/PDF 文件,自动 OCR 提取文本
- 🎯 地面真实数据(Ground Truth)编辑器
- 🚀 使用 AxMiPRO 优化器自动优化提示词
- 📊 显示优化进度和结果评分

## 安装

```bash
npm install
```

## 配置

1. 创建 `.env` 文件(复制 `.env.example`):
```bash
cp .env.example .env
```

2. 在 `.env` 文件中添加你的 OpenAI API Key:
```
OPENAI_APIKEY=your_openai_api_key_here
```

## 启动

```bash
npm run dev
```

服务器将在 http://localhost:3000 启动

## 使用方法

### 1. 输入初始提示词

在 "Initial Prompt" 编辑器中输入你想要优化的提示词。

### 2. 指定 Signatures(可选)

在右侧的 "Signatures" 编辑器中指定优化规则或签名,例如:
```markdown
# Extraction Rules
- Name
- Date  
- Location
```

### 3. 上传示例文件(可选)

- 点击 "Upload Files" 按钮
- 选择图片或 PDF 文件
- 系统会自动进行 OCR 提取文本
- 在 "Ground Truth" 编辑器中输入期望的输出

### 4. 优化

点击 "Optimize" 按钮:
- 系统会收集所有数据并发送到后端
- 使用 AxMiPRO 优化器进行优化
- 优化完成后,初始提示词会被更新为优化后的版本
- 显示最佳评分和试验次数

## 工作原理

### 后端流程

1. **接收请求**: POST `/optimize` 端点接收包含 systemPrompt、signatures 和 examples 的请求体

2. **创建程序**: 根据 systemPrompt 和 signatures 创建 Ax 程序

3. **准备训练数据**: 将每个 tab 的数据(文本和地面真实数据)整理为训练示例

4. **定义评估指标**: 使用 Jaccard 相似度计算输出与地面真实数据的相似度

5. **运行优化**: 使用 AxMiPRO 优化器进行多轮优化试验

6. **返回结果**: 返回优化后的提示词、最佳评分和试验次数

### 前端流程

1. 收集 Initial Prompt 和 Signatures 的内容
2. 收集所有已上传文件的 OCR 文本和 Ground Truth 数据
3. 构建请求 payload 并发送到后端
4. 显示加载状态,等待优化完成
5. 更新 Initial Prompt 为优化后的版本

## API 端点

### POST /optimize

**请求体:**
```json
{
  "systemPrompt": "你的初始提示词",
  "signatures": "你的签名/规则(Markdown格式)",
  "examples": [
    {
      "filename": "example.txt",
      "text": "输入的文本内容",
      "groundTruth": "期望的输出"
    }
  ]
}
```

**响应体:**
```json
{
  "success": true,
  "optimizedPrompt": "优化后的提示词",
  "bestScore": 0.85,
  "numTrials": 5
}
```

## 优化器配置

当前使用的 AxMiPRO 配置:
- **模型**: GPT-4o-mini
- **试验次数**: 5
- **评估指标**: Jaccard 相似度
- **随机种子**: 42

你可以在 `server.ts` 中修改这些配置。

## 技术栈

- **前端**: Vanilla HTML/JS + TailwindCSS + CodeMirror
- **后端**: TypeScript + Node.js
- **优化器**: @ax-llm/ax (AxMiPRO)
- **OCR**: Tesseract.js
- **PDF 处理**: PDF.js

## 注意事项

- 优化过程需要有效的 OpenAI API Key
- 优化可能需要一些时间,请耐心等待
- 建议提供 5-10 个高质量的示例以获得更好的优化效果
- 示例应该多样化,覆盖不同的边界情况

## 许可证

MIT
