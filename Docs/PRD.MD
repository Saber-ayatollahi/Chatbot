📑 Product Requirements Document (PRD)

Project: Fund Management Chatbot – Knowledge Base Training with User Guides
Prepared for: Implementation by Cursor Agentic AI
Owner: Saber Ayatollahi

1. Overview

The Fund Management Chatbot is currently an MVP that guides users through the fund creation process via natural language. While functional, its knowledge is limited to system prompts and general GPT reasoning.

This PRD defines the requirements to train and integrate the chatbot with two detailed User Guides, ensuring responses are grounded in authoritative documentation, compliant, and auditable.

2. Problem Statement

Current chatbot may hallucinate or give incomplete answers when asked about specific fund setup details.

Lack of direct grounding in official guides limits trust and compliance.

No audit trail exists for regulatory review of chatbot responses.

Goal: Use the two User Guides as a structured knowledge base to ground chatbot responses, enforce compliance, and enable continuous learning.

3. Objectives

Knowledge Base Integration: Ingest, process, and index the two guides for retrieval-augmented generation (RAG).

Improved Response Quality: Ensure answers are accurate, contextual, and cite guide references.

Compliance: Provide audit logs and explainability (citations with guide/page references).

Scalability: Support updates when guides are revised.

Continuous Improvement: Enable feedback loop, regression testing, and optional fine-tuning.

4. Scope

In-Scope

Ingest two user guides (PDF/Word).

Chunk, embed, and store guide content in vector DB (pgvector or Pinecone).

Build retrieval middleware and citation-first prompting.

UI support for citations (“Source: Guide 1, p.12”).

Regression test suite derived from guide content.

Feedback capture (👍/👎 + notes).

Versioning of updated guides.

Out-of-Scope

Retail investor chatbot scenarios.

Direct execution of fund transactions.

Non-English training (future phase).

5. Target Users

Fund Managers – Setup of new funds, guided by chatbot with accurate, compliant steps.

Financial Analysts – Ensure hierarchy, rollforward, and security settings align with documentation.

Compliance Teams – Verify chatbot answers match official guides.

Technical Admins – Monitor ingestion pipeline, logs, and system health.

6. Functional Requirements
6.1 Knowledge Base

Ingest Guide 1 and Guide 2 as authoritative sources.

Chunk text semantically (~400–500 tokens with overlap).

Store metadata (source_id, version, heading, page numbers).

Generate embeddings with OpenAI text-embedding-3-large.

Store vectors in Postgres pgvector or Pinecone.

6.2 Retrieval & Prompting

Retrieval middleware retrieves top-N relevant chunks.

Prompt assembler includes citations.

Confidence threshold: if low, chatbot asks clarifying question.

Output format must always cite sources (e.g., Guide 1, p.12).

6.3 User Interface

Display answers with citations.

Provide “View Source” button → open excerpt or PDF page.

Thumbs up/down feedback capture per response.

6.4 Feedback & Analytics

Store feedback in DB (feedback table).

Weekly script clusters low-rated responses.

Admin dashboard: accuracy %, rating %, completion times.

6.5 Versioning

Each ingestion tagged with version.

Retrieval defaults to latest version.

Old versions retained for audit.

6.6 Evaluation & Testing

Auto-generate Q&A pairs from guides.

Human-reviewed golden set (JSONL).

Regression suite ensures >85% accuracy.

CI/CD integration → block PRs if accuracy drops.

6.7 Compliance & Logging

Log every interaction: query, retrieved chunks, citations, final answer.

Provide compliance dashboard with searchable logs.

Redact PII (emails, IDs) during ingestion.

6.8 Fine-Tuning (Future Phase)

Prepare dataset from rated conversations.

Fine-tune GPT for style and flow (not facts).

Keep RAG for factual grounding.

7. Non-Functional Requirements

Performance: Average response <3s.

Scalability: Support 1,000+ concurrent sessions.

Reliability: 99.9% uptime.

Security: CORS, Helmet, API key protection, PII redaction.

Compliance: Audit logs retained ≥1 year.

8. System Architecture
Data Flow

User submits query.

Backend checks if use_kb=true.

Retriever pulls top-N chunks from vector DB.

Prompt assembler adds chunks + citations.

GPT generates response with references.

Response + citations returned to frontend.

User may rate answer (stored in DB).

Logs written for compliance.

Components

Ingestion Pipeline: Loader, normalizer, chunker, embedder.

Vector Store: pgvector/Pinecone.

Retriever Middleware: search, rerank, assemble prompt.

Frontend: Chat UI + citations + feedback.

Admin Tools: Dashboard, CI/CD regression tests.

9. Success Metrics

Accuracy: ≥90% correct answers with proper citations.

User Satisfaction: ≥80% positive ratings.

Compliance: 100% interactions logged with sources.

Performance: <3s average latency.

Regression: No degradation >5% across versions.

10. Risks & Mitigations

Hallucination: Mitigated by RAG + confidence threshold.

Guide Updates: Mitigated by ingestion versioning.

Compliance Breach: Mitigated by audit logs + reviewer dashboard.

Cost Overruns: Mitigated by caching + conversation pruning.

11. Implementation Plan
Phase 1 (Weeks 1–2): Ingestion & Storage

Ingest guides → chunk → embed → store in vector DB.

Validate ingestion with coverage reports.

Phase 2 (Weeks 3–4): Retrieval & Prompting

Implement retriever + prompt assembler.

Add citations in responses.

Phase 3 (Weeks 5–6): UI & Feedback

Add citation display + source viewer.

Add feedback buttons + DB storage.

Phase 4 (Weeks 7–8): Evaluation & CI/CD

Generate Q&A golden set.

Build regression test suite.

Add GitHub Actions pipeline.

Phase 5 (Weeks 9–10): Compliance & Logging

Implement audit logging.

Build compliance dashboard.

Phase 6 (Months 3–6): Fine-Tuning

Collect rated interactions.

Fine-tune GPT for domain style.

Evaluate improvements.

12. Deliverables

/knowledge/ingestion/ (pipeline code + YAML configs).

kb_chunks table schema with embeddings.

retriever.ts, prompt-assembler.ts.

Frontend UI updates (citations, feedback).

Golden Q&A regression test suite.

Compliance logs + dashboard.

Weekly feedback reports.

13. Appendices

Glossary: NAV, Rollforward, Hierarchy, Projection Method.

References: Two User Guides, internal fund documentation.

Sample Q&A:

Q: “Which fields are mandatory in Step 1 of fund creation?”

A: “The required fields are Fund Name, Fund Type, and Currency. Close Date is optional. (Guide 1, p.12)”