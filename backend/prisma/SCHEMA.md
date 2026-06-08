# Database Schema Document

This document describes the database schema, entity relationships, indexes, and role structures designed for the Task Tracker application.

---

## Entity-Relationship Diagram (ERD)

The following Mermaid diagram shows the database tables and their foreign key relationships.

```mermaid
erDiagram
    users ||--o{ project_members : "has memberships"
    users ||--o{ tasks : "assigned tasks"
    users ||--o{ tasks : "creates tasks"
    users ||--o{ comments : "writes comments"
    users ||--o{ activities : "performs activities"
    users ||--o{ task_images : "uploads images"
    users ||--o{ otp_tokens : "has OTP tokens"

    projects ||--o{ project_members : "has members"
    projects ||--o{ tasks : "contains tasks"
    projects ||--o{ activities : "contains activities"

    tasks ||--o{ comments : "has comments"
    tasks ||--o{ task_images : "attaches images"
    tasks ||--o{ activities : "references tasks"

    users {
        string id PK
        string email UK
        string password
        string displayName
        string avatarUrl
        datetime createdAt
        datetime updatedAt
    }

    projects {
        string id PK
        string name
        string description
        string color
        datetime createdAt
        datetime updatedAt
    }

    project_members {
        string id PK
        string userId FK
        string projectId FK
        string role "ADMIN | MEMBER | VIEWER"
        datetime joinedAt
    }

    tasks {
        string id PK
        string title
        string description
        string status "TODO | IN_PROGRESS | REVIEW | COMPLETED"
        string priority "LOW | MEDIUM | HIGH"
        string projectId FK
        string assigneeId FK
        string creatorId FK
        datetime dueDate
        int order
        datetime createdAt
        datetime updatedAt
    }

    task_images {
        string id PK
        string taskId FK
        string originalName
        string storedName
        string url
        int size
        string mimeType
        string uploaderId FK
        datetime createdAt
    }

    comments {
        string id PK
        string text
        string taskId FK
        string userId FK
        datetime createdAt
        datetime updatedAt
    }

    activities {
        string id PK
        string type "TASK_CREATED | STATUS_CHANGED | etc."
        string projectId FK
        string userId FK
        string taskId FK
        json metadata
        datetime createdAt
    }

    otp_tokens {
        string id PK
        string code
        string userId FK
        string purpose "PASSWORD_RESET"
        boolean used
        datetime expiresAt
        datetime createdAt
    }
```

---

## Tables Definition

### 1. `users`
Stores user profile credentials.

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `String` | No | `cuid()` | Primary Key (CUID). |
| `email` | `String` | No | - | Unique login email. |
| `password` | `String` | No | - | Hashed password string. |
| `displayName`| `String` | No | - | User display name. |
| `avatarUrl` | `String` | Yes | `null` | Optional URL pointing to a user profile avatar image. |
| `createdAt` | `DateTime`| No | `now()` | Date and time of user account registration. |
| `updatedAt` | `DateTime`| No | - | Auto-updated on record change. |

---

### 2. `projects`
Stores team projects.

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `String` | No | `cuid()` | Primary Key (CUID). |
| `name` | `String` | No | - | Name of the project space. |
| `description`| `String` | Yes | `null` | Optional description of the project goals. |
| `color` | `String` | No | `#3b82f6` | Hex color tag assigned to the project card. |
| `createdAt` | `DateTime`| No | `now()` | Project creation date and time. |
| `updatedAt` | `DateTime`| No | - | Auto-updated on project details change. |

---

### 3. `project_members`
Junction table mapping users to projects with roles.

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `String` | No | `cuid()` | Primary Key. |
| `userId` | `String` | No | - | Foreign Key referencing `users(id)` (OnDelete: Cascade). |
| `projectId` | `String` | No | - | Foreign Key referencing `projects(id)` (OnDelete: Cascade). |
| `role` | `Enum` | No | - | Member access level (`ADMIN`, `MEMBER`, `VIEWER`). |
| `joinedAt` | `DateTime`| No | `now()` | Timestamp when the user joined the project. |

*Unique Constraint*: Unique pair `[userId, projectId]` ensures a user cannot have duplicate memberships in the same project.

---

### 4. `tasks`
Stores individual work items.

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `String` | No | `cuid()` | Primary Key. |
| `title` | `String` | No | - | Task title. |
| `description`| `String` | Yes | `null` | Optional description. |
| `status` | `Enum` | No | `TODO` | Task column state (`TODO`, `IN_PROGRESS`, `REVIEW`, `COMPLETED`). |
| `priority` | `Enum` | No | `MEDIUM` | Task priority (`LOW`, `MEDIUM`, `HIGH`). |
| `projectId` | `String` | No | - | Foreign Key referencing `projects(id)` (OnDelete: Cascade). |
| `assigneeId` | `String` | Yes | `null` | Foreign Key referencing `users(id)` (OnDelete: SetNull). |
| `creatorId` | `String` | No | - | Foreign Key referencing `users(id)` (OnDelete: Cascade). |
| `dueDate` | `DateTime`| Yes | `null` | Optional task deadline timestamp. |
| `order` | `Int` | No | `0` | Numerical sorting index on board status columns. |
| `createdAt` | `DateTime`| No | `now()` | Task creation timestamp. |
| `updatedAt` | `DateTime`| No | - | Auto-updated on task change. |

---

### 5. `task_images`
Tracks image attachments uploaded to tasks.

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `String` | No | `cuid()` | Primary Key. |
| `taskId` | `String` | No | - | Foreign Key referencing `tasks(id)` (OnDelete: Cascade). |
| `originalName`| `String` | No | - | Original filename submitted by the user. |
| `storedName` | `String` | No | - | Random UUID filename stored on local disk. |
| `url` | `String` | No | - | Public HTTP static file URL. |
| `size` | `Int` | No | - | File size in bytes. |
| `mimeType` | `String` | No | - | Media type of the file (e.g. `image/png`). |
| `uploaderId` | `String` | No | - | Foreign Key referencing `users(id)` (OnDelete: Cascade). |
| `createdAt` | `DateTime`| No | `now()` | Date and time of file upload. |

---

### 6. `comments`
Stores textual comments left under tasks.

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `String` | No | `cuid()` | Primary Key. |
| `text` | `String` | No | - | Comment markdown/plain text. |
| `taskId` | `String` | No | - | Foreign Key referencing `tasks(id)` (OnDelete: Cascade). |
| `userId` | `String` | No | - | Foreign Key referencing `users(id)` (OnDelete: Cascade). |
| `createdAt` | `DateTime`| No | `now()` | Comment submission timestamp. |
| `updatedAt` | `DateTime`| No | - | Timestamp of last comment update. |

---

### 7. `activities`
Audit log recording project actions.

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `String` | No | `cuid()` | Primary Key. |
| `type` | `Enum` | No | - | Action type (`TASK_CREATED`, `STATUS_CHANGED`, etc.). |
| `projectId` | `String` | No | - | Foreign Key referencing `projects(id)` (OnDelete: Cascade). |
| `userId` | `String` | No | - | Foreign Key referencing `users(id)` (OnDelete: Cascade). |
| `taskId` | `String` | Yes | `null` | Optional Foreign Key referencing `tasks(id)` (OnDelete: SetNull). |
| `metadata` | `Json` | Yes | `null` | Structured payload context (e.g., changes, file counts). |
| `createdAt` | `DateTime`| No | `now()` | Event record timestamp. |

---

### 8. `otp_tokens`
Stores short-lived 6-digit OTP codes and their verification status for operations like password resets.

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `String` | No | `cuid()` | Primary Key. |
| `code` | `String` | No | - | The cryptographically secure 6-digit verification code. |
| `userId` | `String` | No | - | Foreign Key referencing `users(id)` (OnDelete: Cascade). |
| `purpose` | `Enum` | No | `PASSWORD_RESET` | Purpose of the OTP code (enum `PASSWORD_RESET`). |
| `used` | `Boolean` | No | `false` | Status tracking if the code has been successfully verified/used. |
| `expiresAt` | `DateTime`| No | - | Time at which the code becomes invalid (15-minute lifespan). |
| `createdAt` | `DateTime`| No | `now()` | Date and time the token was generated. |

---

## Relationships & Cascades

### Task Image Cascades
- **Database Relationship**: Each `TaskImage` record belongs to exactly one `Task`. A single `Task` can have many associated `TaskImages` (up to 10 per request).
- **Cascade Behavior**: The relation is set with `onDelete: Cascade`. When a `Task` is deleted, its related `TaskImage` records are automatically removed from the database by the database engine. In addition, the application service (`TaskImagesService`) intercepts task deletion or deletes individual images, ensuring files on the physical disk are also deleted via Node's filesystem APIs (`unlink`), preventing orphaned disk files.

### OTP Token Cascades
- **Database Relationship**: Each `OtpToken` record belongs to exactly one `User`.
- **Cascade Behavior**: The relation is configured with `onDelete: Cascade`. If a `User` record is permanently deleted, all their associated `OtpToken` records are cascade-deleted by the database automatically.

---

## Role-Based Access Control Model

Permissions are verified using membership records (`ProjectMember`) before executing REST controller methods or subscribing to WebSocket events:
- **`ADMIN`**: Full read-write permission over tasks, comments, and members. Only an Admin can invite new users, change member roles, delete members, update general project metadata, or delete the project.
- **`MEMBER`**: Read-write access to tasks and comments. Can upload image attachments, delete their own uploaded images, create tasks, and update tasks, but cannot alter membership, change project colors/names, or delete the project.
- **`VIEWER`**: Read-only access to tasks. Viewers can read task information, view image attachments, list comments, and write comments. They are strictly prohibited from creating tasks, updating tasks, or uploading/deleting image files.

---

## Database Indexing Strategy

To maintain sub-millisecond query response times at scale, database indexes are placed on columns frequently used in filtering and table joins:

1. **`users(email)`**: An implicit unique index. Enables high-speed user searches during authentication queries (`login`/`register`).
2. **`project_members(userId, projectId)`**: Unique compound index. Accelerates permission guards that fetch user roles in a project.
3. **`tasks(projectId)`**: Implicit relation index. Speeds up queries loading Kanban columns for a project.
4. **`task_images(taskId)`**: Custom indexing on foreign key. Since the most common query on the attachments table is "get all images associated with a task" when loading the details modal, an index on `taskId` guarantees O(1) query lookups.
5. **`comments(taskId)`**: Relation index. Optimizes comment listing queries on task modal open.
6. **`activities(projectId)`**: Relation index. Speeds up project dashboard activity feeds (loaded on the dashboard view).
7. **`otp_tokens(userId)`**: Index on the foreign key relation. Speeds up verification lookup queries matching user ID, purpose, and active code status.
