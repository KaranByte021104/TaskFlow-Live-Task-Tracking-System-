# Task Tracker - Live Collaboration Tool

## Project Overview
Task Tracker is a real-time, lightweight project management and collaborative task tracking application designed as a modern, high-performance alternative to platforms like Jira or Trello. It provides team members and project managers with interactive Kanban boards, activity feeds, instant notifications, task image attachments, custom labels, blocking task dependency enforcement, and detailed PDF/CSV data export capabilities, ensuring seamless workflow synchronization and robust project tracking.

---

## Tech Stack

| Technology | Role in Project |
| :--- | :--- |
| **Next.js** | React framework for building the user-friendly interactive frontend interface. |
| **NestJS** | Progressive Node.js framework providing a modular, scalable REST API and WebSocket gateway. |
| **PostgreSQL** | Relational SQL database utilized for storing structured relational models. |
| **Prisma** | Modern ORM utilized for type-safe database queries and automated schema migrations. |
| **Socket.IO** | Enables bidirectional, event-driven real-time communication (live updates, collaborative presence). |
| **JWT** | JSON Web Tokens for stateless, secure user authentication and authorization. |
| **Zustand** | Lightweight client-side state management for user authentication, toast alerts, and theme preferences. |
| **React Query** | Handles server-state caching, fetching, synchronization, and optimistic UI updates on the frontend. |
| **Tailwind CSS** | Utility-first CSS framework for responsive, modern styling and Dark Mode styling. |
| **Multer** | Middleware for handling `multipart/form-data` uploads (used for task image attachments and user avatar uploads). |
| **Nodemailer** | Library for sending secure OTP email messages via Gmail SMTP. |
| **json2csv** | Utilized on the backend to parse database models and generate structured project CSV exports. |
| **pdfmake** | Backend PDF generation engine used to compile structured PDF documents with custom styling and cover pages. |

---

## Prerequisites

To run this project locally, ensure you have the following installed:
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **PostgreSQL** (v14 or higher)

---

## Getting Started

Follow these numbered steps to clone and run the application locally.

1. **Clone the Repository:**
   ```bash
   git clone <repository-url>
   cd task-tracker
   ```

2. **Install Monorepo Dependencies:**
   Install all package dependencies for both the frontend and backend from the monorepo root:
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   * **Backend Configuration**: Copy `backend/.env.example` to `backend/.env` and update the database credentials and secrets:
     ```bash
     cp backend/.env.example backend/.env
     ```
   * **Frontend Configuration**: Copy `frontend/.env.example` to `frontend/.env.local` and define the backend endpoint URLs:
     ```bash
     cp frontend/.env.example frontend/.env.local
     ```

4. **Initialize Database and Run Migrations:**
   Ensure your local PostgreSQL service is running and the database matches your configured `DATABASE_URL`. Run Prisma migrations to set up schema tables:
   ```bash
   npm run prisma:migrate --workspace=backend
   ```
   *(Alternatively, navigate to `backend` and run `npx prisma migrate dev`)*

5. **Start the Development Servers:**
   Launch both the frontend and backend services in parallel:
   ```bash
   npm run dev
   ```
   - **Frontend** runs on [http://localhost:3000](http://localhost:3000)
   - **Backend** runs on [http://localhost:3001/api](http://localhost:3001/api) (WebSockets namespace on `/realtime`)

---

## Environment Variables

### Backend Environment Variables (`backend/.env`)

| Variable Name | Description | Example / Default Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string containing credentials, host, and database name. | `postgresql://postgres:password@localhost:5432/task_tracker?schema=public` |
| `JWT_SECRET` | Secret key used to sign and verify client authentication tokens. | `super-secret-jwt-key-replace-in-production` |
| `JWT_EXPIRES_IN` | Token expiration lifespan. | `7d` |
| `PORT` | Listening port for the NestJS API application server. | `3001` |
| `FRONTEND_URL` | Allowed origin URL for CORS configuration. | `http://localhost:3000` |
| `BACKEND_URL` | Base public URL of the backend (used to construct image attachment and avatar paths). | `http://localhost:3001` |
| `SMTP_USER` | Gmail SMTP email address used to send verification and password reset emails. | `user@gmail.com` |
| `SMTP_PASS` | Gmail app password (requires Google App Password configuration). | `abcd efgh ijkl mnop` |
| `OTP_JWT_SECRET` | JWT secret used to sign and verify short-lived OTP verification tokens. | `super-secret-otp-jwt-key-replace-in-production` |

### Frontend Environment Variables (`frontend/.env.local`)

| Variable Name | Description | Example / Default Value |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Endpoint base URL for REST API requests. | `http://localhost:3001` |
| `NEXT_PUBLIC_WS_URL` | Endpoint base URL for WebSocket gateway connections. | `http://localhost:3001` |

---

## Architecture Decisions

- **NestJS**: Chosen for its robust structure, clear dependency injection pattern, built-in validation support, and seamless WebSocket gateway support.
- **Prisma**: Selected as the database ORM due to its auto-generated type safety, clear declarative schema models, and easy migration tooling.
- **Zustand & React Query**: We separate global UI state (auth, toast messages, and dark/light themes managed by Zustand) from asynchronous server data (caching, pagination, and data mutations managed by React Query).
- **Socket.IO Project-Based Rooms**: To minimize server memory and network overhead, users subscribe to specific rooms (`project:<projectId>`). Real-time status changes, comments, and task modifications are broadcast only to active members in that specific project space.
- **Local Filesystem Image & Avatar Storage**: Local filesystem storage is utilized for handling task image attachments (under `uploads/tasks/`) and user avatars (under `uploads/avatars/`). This is a lightweight, zero-dependency approach perfect for local development and testing, keeping the system self-contained.
- **Nodemailer with Gmail SMTP**: Selected to deliver reliable, transaction-based OTP (One-Time Password) recovery emails securely without registering with commercial email brokers.

---

## Full Features List

- **Project Management**: Creation and customization of projects with role-based member invitations (Admin, Member, Viewer).
- **Interactive Kanban Board**: Dynamic drag-and-drop task status updates across four columns: To Do, In Progress, Review, and Completed.
- **Real-Time Collaboration**: Automatic syncing of task status changes, comments, attachments, and project presence indicators.
- **Task Comments & Emoji Reactions**: Real-time collaborative comment threads under specific tasks with toggleable emoji reaction buttons.
- **Image Attachments**: Support for uploading, viewing, and deleting multiple image files per task with instant live synchronization.
- **Project-Specific Labels**: Define, edit, and apply custom colored tags to categorize tasks within a project.
- **Task Dependencies**: Establish links between tasks (blocked by / blocking) with strict column transitions block (e.g. cannot start a task if its blockers are unresolved).
- **Audit Logs & History**: Real-time logging of task updates (creation, title/description edits, assignee modifications, due dates, status shifts) visible in an expanded history view.
- **Unified Activity Feed**: Dynamic log of all project and member activities per project space.
- **Dashboard Statistics**: Global and project-specific charts displaying overall completion progress.
- **User Profile Page**: Custom user settings panel enabling name and email updates, alongside custom avatar uploads (with auto-updating fallback initials).
- **Theme Toggle**: Full light and dark mode styling with persistent local settings and native date indicator inversion.
- **Optimistic UI & Toasts**: Instant feedback via toast notifications and fluid UI responses.
- **Optimistic Concurrency Control**: Prevents users from overwriting each other's changes if updates happen simultaneously.
- **OTP Password Recovery**: Secure password reset flow using a 6-digit OTP code sent via Gmail SMTP, verified with a short-lived token.
- **Change Password**: Allows logged-in users to update their password from the sidebar, automatically logging them out and triggering a success notification on redirect.
- **Show/Hide Password Toggle**: Independent visibility toggle button (eye/eye-off icons) integrated into every password input field.
- **CSV and PDF Export**: Export comprehensive project snapshots (tasks, comments, activity log) into high-fidelity PDF layouts (with cover pages) and CSV tables.
- **Board Date Filters**: Client-side filtering by "Created Date" or "Due Date" using preset ranges ("Today", "This Week", "This Month") or a "Custom Range" picker.
- **Auto-Hide Old Tasks**: Cleans up the board by hiding tasks older than 7 days from all columns by default.

---

## Role Permissions

| Action | Admin | Member | Viewer |
| :--- | :---: | :---: | :---: |
| **Create Project** | Yes | Yes | Yes *(Independent creator)* |
| **Delete Project** | Yes *(Owner only)* | No | No |
| **Invite Members** | Yes | No | No |
| **Change Member Roles** | Yes | No | No |
| **Create Tasks** | Yes | Yes | No |
| **Edit Tasks** | Yes | Yes | No |
| **Delete Tasks** | Yes *(Or Task Creator)* | No *(Unless Task Creator)* | No |
| **Post Comments** | Yes | Yes | Yes |
| **Edit/Delete Comments** | Yes *(Creator only)* | Yes *(Creator only)* | Yes *(Creator only)* |
| **Add Emoji Reactions** | Yes | Yes | Yes |
| **Upload Images** | Yes | Yes | No |
| **Delete Images** | Yes | Yes *(Uploader only)* | No |
| **Create/Edit/Delete Labels** | Yes | No | No |
| **Add/Remove Task Labels** | Yes | Yes | No |
| **Add/Remove Task Dependencies**| Yes | Yes | No |
| **Update Own Profile** | Yes | Yes | Yes |
| **Export Project Data (CSV/PDF)**| Yes | Yes | Yes |

*Note: Board date filters and auto-hide are display-only features and are available to all roles equally.*

---

## Known Limitations

- **No Email Verification**: Accounts are registered instantly without email validation.
- **Local Filesystem Storage**: Uploaded files are stored locally, which does not persist across scaled container instances (production requires moving to S3, Cloudinary, or equivalent).
- **In-Memory Presence Tracking**: Active user project rooms are tracked inside the application's RAM. A horizontal-scaling model would require a Redis adapter.
- **No Rate Limiting**: The API endpoints are not rate-limited.
- **No File Content Scan**: Uploaded image attachments undergo extension and MIME verification but are not scanned for malicious scripts or malware.
- **Server-Side PDF Generation**: PDF documents are fully compiled in-memory on the backend using `pdfmake`, which may cause resource usage spikes for very large project exports with hundreds of tasks.
- **Frontend-Only Date Filters**: Date filtering and auto-hiding are handled entirely in memory on the client side. For very large projects with thousands of tasks, switching filters may result in a slight rendering delay.
