# XSight

### See What Drives Sales Success

## Overview

XSight is an AI-powered sales intelligence platform that transforms sales conversations into actionable insights. By analyzing historical sales calls and their outcomes, it uncovers hidden patterns, recurring objections, and the behaviors that drive successful deals.

The platform allows users to ask natural language questions about past sales conversations and receive evidence-based answers derived from internal company data. XSight helps sales teams learn from previous interactions, identify missed opportunities, and continuously improve performance through data-driven decision making.

---

## Key Features

* Natural language questions over historical sales calls
* AI-powered retrieval from an internal sales knowledge base
* Analysis of successful and unsuccessful sales conversations
* Customer objection discovery and categorization
* Sales performance insights and coaching opportunities
* Source-backed answers based on real call data

---

## Example Questions

* What makes successful calls successful?
* Find calls where the agent successfully handled a pricing objection.
* Show examples of calls that failed because of price concerns.
* Find calls where the customer was interested but still did not buy.
* Show calls where the product was not relevant to the customer.
* Compare successful and unsuccessful calls.

---

## System Architecture

```text
User
  ↓
Flask API
  ↓
Amazon Bedrock Knowledge Base
  ↓
Retrieve Relevant Sales Calls
  ↓
Generate Answer
  ↓
Return Insight to User
```

---

## Project Structure

```text
sales-call-rag-assistant/

├── frontend/
├── backend/
│   ├── routes/
│   ├── services/
│   └── utils/
├── data/
│   ├── metadata/
│   ├── transcripts/
│   └── analytics/
├── app.py
├── requirements.txt
├── Dockerfile
└── README.md
```

---

## Installation

### Clone the repository

```bash
git clone <repository-url>
cd sales-call-rag-assistant
```

### Create a virtual environment

```bash
python -m venv .venv
```

### Activate the environment

Windows:

```bash
.venv\Scripts\activate
```

Linux / macOS:

```bash
source .venv/bin/activate
```

### Install dependencies

```bash
pip install -r requirements.txt
```

---

## Configuration

Create a `.env` file and configure your AWS Bedrock settings:

```env
AWS_REGION=your-region
BEDROCK_KNOWLEDGE_BASE_ID=your-kb-id
```

---

## Running the Application

### Local Development

```bash
python app.py
```

The application will be available at:

```text
http://localhost:5000
```

---

## Docker

Build the image:

```bash
docker build -t xsight .
```

Run the container:

```bash
docker run -p 5000:5000 xsight
```

---

## Screenshots

### Dashboard

*(Add screenshot here)*

### Chat Interface

*(Add screenshot here)*

### Knowledge Base Results

*(Add screenshot here)*

---

## Future Improvements

* Advanced sales analytics dashboard
* Automatic call ingestion pipeline
* Trend analysis and forecasting
* Agent performance benchmarking
* Exportable reports and insights

---

## Author

**Lee Ben Shimon**

---

### XSight

**See What Drives Sales Success**
