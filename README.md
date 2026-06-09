# XSight — AI-Powered Sales Intelligence Platform

> **See What Drives Sales Success**

XSight is an AI-powered sales intelligence platform that transforms historical sales call transcripts into actionable business insights. It combines RAG (Retrieval-Augmented Generation) with a Bedrock Agentic AI to answer natural language questions, generate personalized follow-up emails, and produce downloadable performance reports — all through a conversational chat interface.

---

## What Problem Does XSight Solve?

Sales managers lack visibility into why deals are won or lost. Reviewing calls manually is slow, incomplete, and unscalable. XSight analyzes all your sales conversations automatically and lets you ask questions in plain English.

---

## Key Features

- **Natural language Q&A** over historical sales call transcripts (RAG)
- **Agent-powered actions** — send emails, generate reports, filter by product or agent
- **Automated follow-up emails** — AI-generated, personalized per customer objection, sent via Amazon SES
- **Downloadable performance reports** — saved to S3 with 7-day pre-signed URLs
- **File upload pipeline** — upload new call transcripts → auto-analyzed by Claude → CSV updated → Knowledge Base synced
- **Local analytics routing** — fast, deterministic answers for quantitative questions (win rates, scores)
- **Dashboard** — visual overview of all 20+ analyzed calls

---

## ️ System Architecture

```
User (React Frontend)
↓
Flask Backend
↓
┌────────────────────────────────┐
│ Local Analytics Routing │
│ (AnalyticsService + Pandas) │
└────────────────────────────────┘
↓ (qualitative / action requests)
Amazon Bedrock Agent (Claude Sonnet 4.6)
↓ ↓
Knowledge Base Action Groups (Lambda)
(RAG — S3 transcripts) ├── AgentPerformance
├── CallAnalytics
├── FollowupEmail → SES + S3
└── PerformanceReport → S3
```

**Routing logic:**
- Quantitative questions (win rates, scores) → local Flask routing via AnalyticsService
- Qualitative questions (why calls fail, coaching tips) → Bedrock Knowledge Base (RAG)
- Action requests (emails, reports) → Bedrock Agent → Lambda Action Groups

---

## ️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Tailwind CSS |
| Backend | Python + Flask |
| AI Agent | Amazon Bedrock Agent (Claude Sonnet 4.6) |
| RAG | Amazon Bedrock Knowledge Base + S3 |
| Tools | AWS Lambda (4 Action Groups) |
| Email | Amazon SES |
| Storage | Amazon S3 |
| Analytics | Pandas + CSV |
| Deployment | Docker + EC2 |
| Version Control | Git + GitHub |

---

## Project Structure

```
sales-call-rag-assistant/
├── frontend-react/
│ ├── src/
│ │ ├── components/
│ │ │ ├── ChatPage.jsx
│ │ │ ├── DataSourcesPage.jsx
│ │ │ ├── DashboardPage.jsx
│ │ │ └── ...
│ │ ├── App.jsx
│ │ └── main.jsx
│ └── package.json
├── backend/
│ ├── routes/
│ │ ├── chat_routes.py
│ │ └── upload_routes.py
│ ├── services/
│ │ ├── bedrock_agent_service.py
│ │ ├── analytics_service.py
│ │ ├── metadata_service.py
│ │ ├── s3_service.py
│ │ └── call_processing_service.py
│ └── utils/
├── data/
│ └── transcripts/ # 20+ sales call TXT files
├── lambdas/
│ ├── get_agent_performance.py
│ ├── get_call_analytics.py
│ ├── generate_performance_report.py
│ └── generate_followup_email.py
├── app.py
├── requirements.txt
├── Dockerfile
└── README.md
```

---

## ️ Installation & Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- AWS account with Bedrock, S3, SES, Lambda access
- Docker (for containerized deployment)

### 1. Clone the repository

```bash
git clone <repository-url>
cd sales-call-rag-assistant
```

### 2. Backend setup

```bash
python -m venv .venv
source .venv/bin/activate # Linux/macOS
.venv\Scripts\activate # Windows
pip install -r requirements.txt
```

### 3. Frontend setup

```bash
cd frontend-react
npm install
npm run build
```

### 4. Environment variables

Create a `.env` file in the project root:

```env
AWS_REGION=us-east-2
BEDROCK_AGENT_ID=your-agent-id
BEDROCK_AGENT_ALIAS_ID=your-alias-id
BEDROCK_KNOWLEDGE_BASE_ID=your-kb-id
BEDROCK_KB_DATA_SOURCE_ID=your-ds-id
METADATA_BUCKET=your-s3-bucket
METADATA_KEY=transcripts/sales_calls_metadata.csv
CALLS_PREFIX=transcripts/
EMAILS_PREFIX=emails/
REPORTS_PREFIX=reports/
SENDER_EMAIL=your-verified-ses-email
DEMO_RECIPIENT=your-email
BEDROCK_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0
```

---

## Running the Application

### Local development

```bash
python app.py
```

The application will be available at `http://localhost:5000`

### Docker

```bash
docker build -t xsight .
docker run -p 5000:5000 --env-file .env xsight
```

---

## Example Questions

### RAG — Qualitative insights
```
Why do calls fail when customers raise pricing objections?
What makes Sarah Levi's calls successful?
Show examples of calls where timing was the main objection
```

### Analytics — Quantitative stats
```
How is Daniel Cohen performing?
What is the win rate of each agent?
Compare successful vs unsuccessful calls
```

### Actions — Agent + Lambda
```
Send follow-up emails to all customers who didn't buy this month
Export a downloadable performance report for Sarah Levi
Which agent performs best with CloudSecure?
```

---

## Lambda Action Groups

| Action Group | Function | Description |
|---|---|---|
| AgentPerformance | `get_agent_performance` | Win rates, scores, optional product filter |
| CallAnalytics | `get_call_analytics` | Success comparison, product performance, overall stats |
| PerformanceReport | `generate_performance_report` | Generates JSON report, saves to S3, returns pre-signed URL |
| FollowupEmail | `generate_followup_email` | AI-generated personalized emails, sent via SES + saved to S3 |

---

## ️ AWS Resources

| Resource | Purpose |
|---|---|
| Amazon Bedrock Agent | Orchestration + reasoning (Claude Sonnet 4.6) |
| Amazon Bedrock Knowledge Base | RAG over sales call transcripts |
| Amazon S3 | Transcripts, CSV metadata, reports, emails |
| AWS Lambda (×4) | Action Groups for analytics and automation |
| Amazon SES | Follow-up email delivery |
| Amazon EC2 | Docker container hosting |

---

## ️ AWS Cleanup

After testing, the following resources were deleted to avoid unnecessary costs:
- EC2 instance (stopped and terminated after demo)
- Bedrock Knowledge Base and data source
- S3 bucket contents
- Lambda functions
- SES verified identities

---

## ‍ Author

**Lee Ben Shimon**
AI-Augmented Software Engineering