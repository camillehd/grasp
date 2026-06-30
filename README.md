# Grasp

**Turn any academic paper into an interactive, queryable knowledge graph you can actually learn from.**

Upload a PDF. Grasp maps out every concept you need to understand into 'nodes', shows you how they connect, and lets you ask questions about any of them in plain English. It also generates a narrative learning path based on the nodes, which walks you from zero to understanding the paper's contribution, in order. Everything runs locally on your machine.

---

## What it looks like

- **Graph view** — a visual map of every concept in the paper. Click any node to open a chat where you can ask anything about it. The graph highlights everything that concept depends on.
- **Learning path** — a narrative guide that tells the story of the paper chapter by chapter, with the concepts embedded in the order you should encounter them.

---

## Before you start

### 1. Python 3.12
Check if you have it:
```
python3.12 --version
```
If you don't get a version number, install it:
- **Mac:** `brew install python@3.12` (requires [Homebrew](https://brew.sh) — paste that one-liner and follow the prompts)
- **Windows/Linux:** Download from [python.org](https://www.python.org/downloads/)

### 2. Node.js (version 18 or newer)
Check:
```
node --version
```
If not installed: [nodejs.org](https://nodejs.org) → download the "LTS" version.

### 3. An Anthropic API key
Grasp uses Claude to analyze papers. You'll need a free account and an API key.

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign up
2. Click **API Keys** in the left sidebar → **Create Key**
3. Copy the key (it starts with `sk-ant-...`) 

> **Cost:** Analyzing one paper typically costs $0.30–$0.80 in API credits. Anthropic gives new accounts free credits to start.

---

## Setup (one time)

**1. Download Grasp**

Click the green **Code** button at the top of this page → **Download ZIP** → unzip it somewhere on your computer.

Or if you use git:
```bash
git clone https://github.com/YOUR_USERNAME/grasp.git
cd grasp
```

**2. Run the setup script**

Open a terminal, navigate to the `grasp` folder, and run:

```bash
bash setup.sh
```

The script will ask you to paste your Anthropic API key — it won't be shown on screen as you type. It validates the format and saves it locally. Nothing leaves your machine.

This installs all dependencies automatically. It takes 1–2 minutes total.

> **Mac tip:** To open a terminal in the grasp folder, right-click the folder in Finder → "New Terminal at Folder" (or open Terminal and type `cd ` then drag the folder in).

---

## Running Grasp

Every time you want to use Grasp, you need two terminal windows open simultaneously.

**Terminal 1 — start the backend:**
```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload
```
You'll see `Application startup complete.` when it's ready.

**Terminal 2 — start the frontend:**
```bash
cd frontend
npm run dev
```
You'll see a URL like `http://localhost:5173`.

**Open your browser and go to [http://localhost:5173](http://localhost:5173)**

---

## Using Grasp

1. **Drop a PDF** into the upload box in the top-left sidebar. Any academic paper works — arXiv papers, conference papers, journal articles.
2. **Wait ~30–60 seconds** while Grasp analyzes the paper. The status updates in real time.
3. **Explore the graph.** Nodes are color-coded by type. Click any node to open the chat panel on the right.
4. **Ask questions.** Type anything in the chat bar — "Why does this matter?", "Can you explain this like I'm 5?", "How does this connect to X?" — and have a full conversation.
5. **Switch to Learning Path** (top-right toggle) for a narrative walkthrough of the paper from start to finish.

---

## Node colors

| Color | Meaning |
|---|---|
| Purple | Core contribution — the paper's main idea |
| Blue | Method — a technique or algorithm |
| Teal | Theory — a mathematical or conceptual framework |
| Amber | Dataset |
| Pink/Red | Metric — how results are measured |
| Gray | Background — concepts the paper assumes you know |

---

## Troubleshooting

**"Address already in use" error on port 8000**
Something else is already running there. Kill it:
```bash
kill $(lsof -ti:8000)
```
Then start the backend again.

**"No module named X" error**
Make sure you activated the virtual environment first:
```bash
source backend/.venv/bin/activate
```

**The graph appears but is empty / has very few nodes**
The paper may have complex formatting. Try a different PDF — arXiv papers (downloaded as PDF from arxiv.org) work best.

**Setup fails on Python version**
Make sure you have Python 3.12 specifically:
```bash
python3.12 --version
```
If you only have 3.13+, the setup script handles it — but 3.14 is not supported yet by one of the dependencies. Install 3.12 with `brew install python@3.12`.

---

## How it works

When you upload a paper, five AI agents run in sequence:

1. **Ingestion** — parses the PDF into sections, figures, and references
2. **Concept extractor** — identifies 8–20 key concepts and writes plain-English descriptions
3. **Dependency mapper** — figures out which concepts are prerequisites for others
4. **Enrichment** — writes detailed background explanations for concepts the paper assumes you know
5. **Critic** — validates every dependency edge and removes spurious ones for accuracy

The result is saved locally as a JSON file. When you open the Learning Path, one more agent runs to write the narrative guide (cached after the first time).

---

## Privacy

Everything runs locally on your machine. Your PDFs are processed in memory and not stored permanently. The only data that leaves your computer is the paper text sent to Anthropic's API to generate the graph — subject to [Anthropic's privacy policy](https://www.anthropic.com/privacy).
