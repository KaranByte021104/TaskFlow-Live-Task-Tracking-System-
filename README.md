# Task Tracker - Live Collaboration Tool

## Project Overview
Task Tracker is a real-time project management and collaborative task tracking application. It provides team members with interactive Kanban boards, multi-channel chat systems, activity feeds, instant notifications, task/chat file attachments, custom labels, blocking task dependency enforcement, and project exports, ensuring seamless workflow synchronization and robust project tracking.

---

## Tech Stack

| Technology | Role in Project |
| :--- | :--- |
| **Next.js** | React framework for building the frontend standalone user interface. |
| **NestJS** | Progressive Node.js framework providing a modular REST API and WebSocket gateway. |
| **PostgreSQL** | Relational SQL database utilized for storing structured relational models. |
| **Prisma** | Modern ORM utilized for type-safe database queries and automated schema migrations. |
| **Redis** | In-memory storage acting as API cache, user presence tracker, and BullMQ broker. |
| **BullMQ** | Message queue system for offloading asynchronous background tasks. |
| **Socket.IO** | Enables bidirectional, event-driven real-time updates and presence. |
| **JWT** | JSON Web Tokens with Secure Family Rotation (RTR) for stateless authorization. |
| **Zustand** | Lightweight client-side state management for user authentication and theme preferences. |
| **React Query** | Handles server-state caching, fetching, and optimistic UI updates on the frontend. |
| **Tailwind CSS** | Utility-first CSS framework for responsive, modern styling and Dark Mode. |
| **Multer** | Middleware for handling multipart/form-data uploads. |
| **Nodemailer** | Library for sending secure email notifications and OTP recovery via Gmail SMTP. |
| **json2csv & pdfmake** | Backend PDF and CSV compilers for compiling and downloading project snapshots. |

---

## Prerequisites

To run this project, ensure you have the following installed:
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **Docker & Docker Compose** (for containerized setup)
- **PostgreSQL & Redis** (if running services natively)

---

## Running with Docker (Recommended)

Docker Compose containerizes the database, cache, backend, and frontend for clean execution.

### Workflow A: Full-Stack Containerization
This workflow brings up all four services inside containers.

1. **Verify environment files exist**:
   - Backend expects `backend/.env` (copied from `backend/.env.example`).
   - Frontend expects `frontend/.env.local` (copied from `frontend/.env.example`).
2. **Build and start the compose stack**:
   From the root `task-tracker` folder, run:
   ```bash
   docker compose up --build
   ```
3. **Access the application**:
   - **Frontend**: [http://localhost:3000](http://localhost:3000)
   - **Backend API**: [http://localhost:3001/api](http://localhost:3001/api)
   - **Health status**: [http://localhost:3001/health](http://localhost:3001/health)

---

### Workflow B: Lightweight Running Mode (For Constrained Systems)
On lower-resource machines (e.g. 8GB RAM or less), running multiple Docker containers alongside Next.js compiles can cause performance issues. You can instead run only the infrastructure (PostgreSQL and Redis) inside Docker, and run the backend/frontend servers natively.

1. **Start PostgreSQL & Redis**:
   ```bash
   docker compose up postgres redis -d
   ```
2. **Install Monorepo Dependencies**:
   From the root directory, run:
   ```bash
   npm install
   ```
3. **Initialize Database Schema**:
   Generate the Prisma Client and deploy migrations:
   ```bash
   npm run prisma:migrate --workspace=backend
   ```
4. **Launch Development Servers**:
   ```bash
   npm run dev
   ```
   - **Frontend** runs natively on [http://localhost:3000](http://localhost:3000)
   - **Backend** runs natively on [http://localhost:3001](http://localhost:3001)

---

## Environment Variables

### Backend Environment Variables (`backend/.env`)

| Variable Name | Description | Example / Default Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string. | `postgresql://postgres:password@localhost:5432/task_tracker?schema=public` |
| `REDIS_URL` | Redis connection endpoint string. | `redis://localhost:6379` |
| `JWT_SECRET` | Secret key used to sign and verify client authentication tokens. | `super-secret-jwt-key` |
| `JWT_EXPIRES_IN` | Life-span duration for access tokens. | `15m` |
| `PORT` | Listening port for the NestJS API application server. | `3001` |
| `FRONTEND_URL` | Origin URL for CORS configuration. | `http://localhost:3000` |
| `SMTP_USER` | Gmail address used to send verification and notification emails. | `user@gmail.com` |
| `SMTP_PASS` | Gmail app password configuration. | `abcd efgh ijkl mnop` |
| `OTP_JWT_SECRET` | JWT secret used to sign OTP verification tokens. | `super-secret-otp-jwt-key` |

---

## Full Features List

- **Project Management**: Project creation with custom colors and statistics tracking.
- **Interactive Kanban Board**: Drag-and-drop status transitions with column limit indicators.
- **Real-Time Collaboration**: Automatic syncing of tasks, comments, and member presence via Socket.IO.
- **Multi-Channel Team Chat**: Public and private channels, archiving controls, inline media rendering, and direct messaging.
- **Background Mailer**: BullMQ queues with Redis for asynchronous notification and OTP delivery.
- **Task Dependencies**: Strict blocked-by enforcement (cannot start a task until blocking tasks are resolved) with circular dependency protection.
- **Audit Logs & History**: Record of changes on tasks displayed in a timeline view.
- **Unified Search**: Relational text search spanning projects, tasks, comments, files, and chat messages.
- **Rate Limiting**: Global sliding window rate limiting (100 req/min per IP) to prevent API flooding.
- **CSV and PDF Export**: Multi-page project data compilation.
- **Theme Toggle**: Full light/dark mode styling.

---

## Role Permissions

| Action | Admin | Manager | Member | Viewer |
| :--- | :---: | :---: | :---: | :---: |
| **Delete Project** | Yes *(Owner)* | No | No | No |
| **Invite Members / Change Roles** | Yes | No | No | No |
| **Create/Edit/Archive Channels** | Yes | Yes | Yes *(Owner)*| No |
| **Create Tasks** | Yes | Yes | Yes | No |
| **Edit Tasks / Manage Dependencies**| Yes | Yes | Yes | No |
| **Delete Tasks** | Yes | Yes | No *(Unless creator)*| No |
| **Upload Project Files** | Yes | Yes | Yes | No |
| **Delete Project Files** | Yes | Yes | Yes *(Uploader)*| No |
| **Post Comments / Add Reactions** | Yes | Yes | Yes | Yes |

---

## Known Limitations

1. **IP-Based Rate Limiting Bypass**: IP-based throttling can be bypassed if an attacker rotates their IP address (production requires additional web application firewalls or API gateway shielding).
2. **Search Scaling**: Text queries use PostgreSQL `ILIKE` operations. This does not scale efficiently for huge databases (production would require Elasticsearch or Postgres full-text search indexes).
3. **Single-Instance Redis**: Presence and BullMQ tracking assume a single Redis instance. Scale out requires setting up Redis Sentinel or Redis Cluster.
4. **Gmail SMTP Limits**: Transactional emails are sent via Gmail SMTP, which has strict daily sending caps. Production setups should migrate to SES, SendGrid, or Mailgun.
5. **Non-Optimized Chat Images**: Uploaded chat images are served at original resolutions, which can degrade rendering speeds for channels with heavy image attachments (production requires thumbnail generation pipelines).
