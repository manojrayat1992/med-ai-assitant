<div align="center">

# 🩺 Med-AI Clinical Intelligence

**Enterprise Clinical Quality Assurance & Decision-Support Infrastructure for Radiology Teams**

*AI drafts and validates. Licensed clinicians review, verify, and sign.*

[![CI/CD Pipeline](https://github.com/manojrayat1992/med-ai-assitant/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/manojrayat1992/med-ai-assitant/actions/workflows/ci-cd.yml)
[![Java 21](https://img.shields.io/badge/Java-21-orange?style=flat&logo=openjdk)](https://openjdk.org/projects/jdk/21/)
[![Spring Boot 3.3](https://img.shields.io/badge/Spring%20Boot-3.3-green?style=flat&logo=springboot)](https://spring.io/projects/spring-boot)
[![React 19](https://img.shields.io/badge/React-19-blue?style=flat&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL pgvector](https://img.shields.io/badge/PostgreSQL-16%20%2B%20pgvector-336791?style=flat&logo=postgresql)](https://github.com/pgvector/pgvector)
[![FHIR R4](https://img.shields.io/badge/Standards-FHIR%20R4%20%7C%20ABDM-teal)](#standards--compliance)
[![License](https://img.shields.io/badge/License-Proprietary-red)](#license)

[🌐 Marketing & Documentation](https://medaiclinical.com) &nbsp;•&nbsp; [🏥 Clinical Application](https://app.medaiclinical.com) &nbsp;•&nbsp; [📖 Architectural Guides](#architecture--documentation)

---

</div>

## 📌 Executive Summary

**Med-AI Clinical** is an enterprise clinical intelligence and quality-assurance (QA) layer designed specifically for diagnostic imaging centers, radiology groups, and teleradiology networks.

Rather than attempting autonomous diagnosis, Med-AI acts as a **second pair of eyes** directly inside the radiologist’s reporting workflow:
- **Catches discrepancies** (e.g., laterality mismatches, missing recommendations, critical unaddressed findings) *before* signature.
- **Performs longitudinal comparison** against prior imaging reports to track progression or resolution over time.
- **Maps free-text clinical findings** to standardized anatomical structures and ontological codes.
- **Guarantees human-in-the-loop integrity** with non-repudiable audit logs and physician sign-off workflows.

---

## 📸 Product Interface

<div align="center">

### 1. Clinical Review Workspace
*Interactive report drafting, automated finding extraction, real-time QA alerts, and anatomical context.*
<br/>
<img src="marketing/screenshots/app-clinical-workspace.png" alt="Clinical Review Workspace" width="900" style="border-radius:8px; box-shadow:0 4px 20px rgba(0,0,0,0.15);" />

<br/><br/>

### 2. Reading Room Worklist & Triage
*Multi-tenant queue with urgency indicators, critical finding alerts, and review statuses.*
<br/>
<img src="marketing/screenshots/app-worklist.png" alt="Reading Room Worklist" width="900" style="border-radius:8px; box-shadow:0 4px 20px rgba(0,0,0,0.15);" />

<br/><br/>

### 3. QA Analytics & Audit Dashboard
*Action acceptance rates, physician dismissal analytics, critical escalation tracking, and turn-around time metrics.*
<br/>
<img src="marketing/screenshots/app-qa-analytics.png" alt="QA Analytics Dashboard" width="900" style="border-radius:8px; box-shadow:0 4px 20px rgba(0,0,0,0.15);" />

</div>

---

## 🔄 Clinical Workflow

```mermaid
flowchart TD
    classDef sys fill:#0f172a,stroke:#38bdf8,stroke-width:1.5px,color:#f8fafc;
    classDef ai fill:#064e3b,stroke:#34d399,stroke-width:1.5px,color:#ecfdf5;
    classDef clinician fill:#1e1b4b,stroke:#a78bfa,stroke-width:1.5px,color:#f5f3ff;
    classDef sign fill:#14532d,stroke:#22c55e,stroke-width:2px,color:#f0fdf4;

    A[PACS / RIS / Voice Dictation]:::sys -->|Draft Report Ingestion| B[Med-AI Clinical Gateway]:::sys
    
    subgraph AI_QA ["Clinical Intelligence & QA Engine"]
        B --> C1[Laterality & Consistency Rules]:::ai
        B --> C2[Structured Finding Extraction]:::ai
        B --> C3[Prior Report Longitudinal Comparison]:::ai
        B --> C4[Anatomical Mapping & 3D Visualization]:::ai
        B --> C5[Critical Findings & Recommendation Engine]:::ai
    end

    C1 & C2 & C3 & C4 & C5 --> D[Radiologist Clinical Workspace]:::clinician

    subgraph Review ["Human-in-the-Loop Verification"]
        D -->|Accept AI Suggestion| E1[Amend Draft]:::clinician
        D -->|Dismiss / Reject| E2[Log Reason in Audit Trail]:::clinician
        D -->|Manual Correction| E3[Update Impression]:::clinician
    end

    E1 & E2 & E3 --> F[Physician Cryptographic Sign-Off]:::sign
    F -->|FHIR R4 DiagnosticReport| G[EMR / RIS / Patient Portal]:::sys
```

---

## ⚡ Core Capabilities

### 1. 🛡️ Report Quality Assurance Engine
* **Laterality Discrepancy Detection**: Identifies conflicts between findings (e.g., "right apical nodule" in findings vs "left" in impression).
* **Missing Recommendation Tracking**: Flags critical or indeterminate findings where guideline-recommended follow-up intervals are omitted.
* **Terminology Standardization**: Maps free-text findings to standardized RadLex, SNOMED-CT, and LOINC codes.

### 2. 🧠 Multi-Tenant AI Orchestration
* **Dynamic Provider Switching**: Seamless orchestration across Anthropic Claude, OpenAI, and local LLM instances (Ollama / HuggingFace).
* **Per-Tenant Configuration**: Allows hospitals and diagnostic chains to configure provider API keys, fallbacks, and temperature settings at the tenant level.
* **Audit & Token Accounting**: Granular token usage tracking and latency metrics per request.

### 3. 🦴 Anatomy Mapping & Visualization
* **Structured Spatial Mapping**: Automatically tags identified abnormalities to canonical anatomical regions.
* **Interactive 3D Views**: Integrates Three.js anatomical visualizations for orientation and patient-facing educational reports.

### 4. 📈 Longitudinal Finding Comparison
* **Historical Prior Analysis**: Automatically retrieves previous imaging reports for the patient across the RIS.
* **Temporal Trend Tracking**: Highlights interval changes (size increase, reduction, new lesions, stable findings) across serial scans.

### 5. 🔒 Security, Compliance & Data Residency
* **Data Residency**: Deployed in AWS Mumbai (`ap-south-1`) to strictly comply with India's **Digital Personal Data Protection (DPDP) Act**.
* **Zero PHI Leaks**: Ephemeral AI inference without model retraining on patient data.
* **RBAC & OIDC**: Fine-grained role-based access control, tenant isolation, and cryptographic audit logs.

---

## 🏛️ System Architecture

```
med-ai-assistant/
├── backend/                       # Spring Boot 3.3 (Java 21) REST & WebSocket API
│   ├── src/main/java/com/medai/
│   │   ├── analysis/             # AI orchestration & finding extraction
│   │   ├── anatomy/              # 3D anatomy mapping & spatial coordinates
│   │   ├── qa/                   # Report QA rules engine (Laterality, consistency)
│   │   ├── longitudinal/         # Prior report comparison & interval analysis
│   │   ├── report/               # Clinical reporting & workflow lifecycle
│   │   ├── tenant/               # Multi-tenant config & custom provider settings
│   │   └── security/             # DPDP / HIPAA compliance, JWT & RBAC
│   └── pom.xml
├── frontend/                      # React 19 + TypeScript + Vite SPA
│   ├── src/
│   │   ├── pages/                # Worklist, Clinical Workspace, Analytics, Anatomy
│   │   ├── components/           # Theme-aware, accessible clinical UI components
│   │   ├── services/             # Axios API clients & WebSocket handlers
│   │   └── stores/               # Zustand state stores (Theme, Auth, Case)
│   └── package.json
├── marketing/                     # Static marketing site (Cloudflare Workers Assets)
│   ├── index.html, product.html, pricing.html, security.html, validation.html
│   └── styles.css
├── docker/                        # Production multi-stage Dockerfiles
├── helm/                          # Kubernetes Helm charts for EKS deployment
└── wrangler.jsonc                 # Cloudflare Workers configuration for marketing site
```

---

## 💻 Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Backend Engine** | Java 21, Spring Boot 3.3, Spring Security, Spring Data JPA, Flyway |
| **Database & Vector**| PostgreSQL 16, pgvector (semantic embedding similarity), Redis |
| **Frontend App** | React 19, TypeScript, Vite, Vanilla CSS & Dynamic Design Tokens, Zustand |
| **Visualization** | Three.js (interactive anatomy), Chart.js / Recharts |
| **Clinical Interop** | FHIR R4, DICOM SR, ABDM (Ayushman Bharat Digital Mission) |
| **Cloud & DevOps** | Docker, Kubernetes (AWS EKS), AWS ECR, Cloudflare Workers, GitHub Actions |

---

## 🚀 Getting Started

### Prerequisites
- **Java 21** (Temurin / OpenJDK)
- **Node.js 20+** and `npm`
- **Docker** & **Docker Compose**
- **PostgreSQL 16** with `pgvector` extension

### 1. Clone the Repository
```bash
git clone git@github.com:manojrayat1992/med-ai-assitant.git
cd med-ai-assitant
```

### 2. Environment Configuration
Copy the example environment file and update your credentials:
```bash
cp .env.example .env
```

### 3. Run with Docker Compose (Fastest)
```bash
docker compose up -d postgres redis
```

### 4. Run Backend Locally
```bash
cd backend
mvn clean install -DskipTests
mvn spring-boot:run
```
*Backend API boots on `http://localhost:8080` (Swagger UI at `/swagger-ui.html`).*

### 5. Run Frontend Locally
```bash
cd frontend
npm install
npm run dev
```
*Clinical app boots on `http://localhost:5173`.*

---

## ⚠️ Regulatory & Scope Transparency

To maintain regulatory integrity (CDSCO & US FDA 21 CFR Part 820):

| ❌ What Med-AI is **NOT** | ✅ What Med-AI **IS** |
| :--- | :--- |
| 🚫 An autonomous diagnostic AI | 🛡️ A clinical QA and consistency reviewer |
| 🚫 An autonomous image classifier | 📄 A natural language report intelligence assistant |
| 🚫 A prescription or treatment generator | 🔍 An anomaly flagger for physician attention |
| 🚫 A replacement for PACS or RIS | 🔌 An interoperable decision-support plugin |

> **Clinical Disclaimer:** Med-AI outputs are decision-support suggestions intended exclusively for licensed radiologists and healthcare professionals. Every report amendment and sign-off requires independent physician verification.

---

## 📖 Architecture & Documentation

- [AWS Production Deployment Guide](docs/DEPLOYMENT-AWS.md)
- [Low-Cost / Startup Hosting Architecture](docs/DEPLOYMENT-CHEAP.md)
- [Cloudflare Marketing Site Configuration](docs/MARKETING-SITE.md)
- [3D Anatomy Visualization Specifications](docs/ANATOMY-3D-ASSET.md)

---

## 📄 License

Proprietary & Confidential. All rights reserved. &copy; Med-AI Clinical Intelligence.
