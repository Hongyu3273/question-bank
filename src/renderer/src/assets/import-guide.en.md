# Question bank import formats

Three file types are supported, and you can pick several files at once:

| Format | Best for | Images |
|---|---|---|
| `.zip` archive | Banks with images (recommended) | Yes |
| `.md` Markdown | Text-only banks | No |
| `.xlsx` Excel | Questions kept in a spreadsheet | No |

## 1. Markdown (.md)

```markdown
# Java Basics

## What is the difference between HashMap and Hashtable?
---answer---
1. HashMap is not thread-safe; Hashtable is
2. HashMap allows null keys and values

## What is the JVM?
---answer---
The Java Virtual Machine, which runs bytecode.

![JVM structure](images/jvm.png)
```

Rules:

- The first `# Heading` is the bank name; if omitted, the file name is used
- Each `## ` starts a question; the text after it is the question (up to 500 characters)
- Put `---answer---` on its own line right after the question; everything until the next `## ` is the answer
- Nothing else may go between the question and `---answer---`
- Answers support Markdown: lists, tables, code blocks, math and images; use `###` for headings inside an answer
- `##` and `---answer---` inside code blocks are ignored

## 2. Question details (optional)

Put them at the very start of the answer:

```markdown
## Introduce yourself
---answer---
*English: Tell me about yourself.*

> Priority: 高 | Category: General | Source: SEEK

Answer text…
```

- `*English: …*`: the English question, which can be shown or hidden in Settings
- Priority values are `高` (high), `中` (medium) and `低` (low); separate fields with `|` or `｜`; every field is optional
- Questions without a priority are grouped under "Not set"; you can set priorities in bulk in Manage after importing

## 3. Archive (.zip, with images)

```text
Java Basics.zip
└── Java Basics/
    ├── questions.md
    └── images/
        └── jvm.png
```

- Each folder holds one `questions.md` and an `images/` folder
- Reference images in answers as `![](images/jvm.png)`
- One archive can hold several bank folders; they are imported together
- Images can be png, jpg, gif, webp or svg, up to 10 MB each

## 4. Excel (.xlsx)

The first sheet is read. Row 1 is the header; each following row is one question:

| Question | Answer | Priority | Category | English | Source |
|---|---|---|---|---|---|
| What is the JVM? | The Java Virtual Machine, which runs bytecode. | 高 | Java | What is the JVM? | Interview notes |

- Required columns: `Question` (or Title, 题干) and `Answer` (or 答案)
- Other columns are optional, in any order
- The bank is named after the file; images are not supported

## 5. When importing

- If a bank with the same name exists, you choose: overwrite, save as a new bank, or skip
- Format problems are listed with question and line numbers; the other questions are still imported
- Markdown and Excel templates can be downloaded under Settings → Data

> Tip: send this guide to an AI together with your notes and ask it to turn them into a bank file in this format.
