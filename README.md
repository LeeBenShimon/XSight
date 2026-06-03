# sales-call-rag-assistant

Project scaffold with separated frontend and backend layers.

## Structure

```text
sales-call-rag-assistant/
├── frontend/
│   ├── templates/
│   │   └── index.html
│   └── static/
│       ├── css/
│       └── js/
├── backend/
│   ├── services/
│   │   ├── bedrock_service.py
│   │   ├── metadata_service.py
│   │   └── analytics_service.py
│   ├── routes/
│   │   └── chat_routes.py
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