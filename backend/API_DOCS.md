# Task Tracker REST API Documentation

This document covers all REST API endpoints available in the Task Tracker backend.

All routes are prefixed with `/api`. Authenticated endpoints require a Bearer token in the `Authorization` header:
`Authorization: Bearer <JWT_TOKEN>`

---

## Authentication Endpoints

### 1. User Registration
Creates a new user account.

- **HTTP Method**: `POST`
- **Path**: `/api/auth/register`
- **Authentication**: None
- **Request Body**:
  - `name` (string, required): Full name or display name.
  - `email` (string, required): Valid email address (must be unique).
  - `password` (string, required): Minimum length 6 characters.

#### Example Request
```json
POST /api/auth/register
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securepassword123"
}
```

#### Example Response (`201 Created`)
```json
{
  "user": {
    "id": "cuid-user-123",
    "email": "jane@example.com",
    "displayName": "Jane Doe",
    "avatarUrl": null,
    "createdAt": "2026-06-05T10:06:06.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

- **Error Responses**:
  - `400 Bad Request`: Validation failure.
  - `409 Conflict`: Duplicate entry error.
    ```json
    {
      "statusCode": 409,
      "message": "Duplicate entry: A record with this email already exists",
      "path": "/api/auth/register",
      "timestamp": "2026-06-05T10:06:06.000Z"
    }
    ```

---

### 2. User Login
Authenticates an existing user and issues a token.

- **HTTP Method**: `POST`
- **Path**: `/api/auth/login`
- **Authentication**: None
- **Request Body**:
  - `email` (string, required)
  - `password` (string, required)

#### Example Request
```json
POST /api/auth/login
{
  "email": "jane@example.com",
  "password": "securepassword123"
}
```

#### Example Response (`200 OK`)
```json
{
  "user": {
    "id": "cuid-user-123",
    "email": "jane@example.com",
    "displayName": "Jane Doe",
    "avatarUrl": null
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

- **Error Responses**:
  - `401 Unauthorized`: Invalid email or password.

---

### 3. Get Current User Profile
Retrieves authenticated user metadata.

- **HTTP Method**: `GET`
- **Path**: `/api/auth/me`
- **Authentication**: Required (JWT Bearer Token)

#### Example Response (`200 OK`)
```json
{
  "id": "cuid-user-123",
  "email": "jane@example.com",
  "displayName": "Jane Doe",
  "avatarUrl": null,
  "createdAt": "2026-06-05T10:06:06.000Z",
  "updatedAt": "2026-06-05T10:06:06.000Z"
}
```

---

### 4. Request Password Reset OTP
Generates a secure 6-digit OTP code and emails it to the user.

- **HTTP Method**: `POST`
- **Path**: `/api/auth/request-otp`
- **Authentication**: None
- **Request Body**:
  - `email` (string, required): Registered user email address.

#### Example Request
```json
POST /api/auth/request-otp
{
  "email": "jane@example.com"
}
```

#### Example Response (`201 Created`)
*Note: Always returns a generic response message to prevent email enumeration.*
```json
{
  "message": "If an account with that email exists, a 6-digit code has been sent. It expires in 15 minutes."
}
```

---

### 5. Verify Password Reset OTP
Verifies the 6-digit OTP sent via email and returns a short-lived password reset verification token.

- **HTTP Method**: `POST`
- **Path**: `/api/auth/verify-otp`
- **Authentication**: None
- **Request Body**:
  - `email` (string, required): Registered user email address.
  - `code` (string, required): 6-digit OTP code.

#### Example Request
```json
POST /api/auth/verify-otp
{
  "email": "jane@example.com",
  "code": "582194"
}
```

#### Example Response (`201 Created`)
```json
{
  "verificationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

- **Error Responses**:
  - `400 Bad Request`: Invalid or expired code.

---

### 6. Set New Password
Uses the verification token to securely set a new password.

- **HTTP Method**: `POST`
- **Path**: `/api/auth/set-new-password`
- **Authentication**: None
- **Request Body**:
  - `verificationToken` (string, required): Short-lived token returned from `/api/auth/verify-otp`.
  - `newPassword` (string, required): New password (minimum length 8 characters).

#### Example Request
```json
POST /api/auth/set-new-password
{
  "verificationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "newPassword": "newsecurepassword123"
}
```

#### Example Response (`201 Created`)
```json
{
  "message": "Your password has been reset successfully."
}
```

- **Error Responses**:
  - `400 Bad Request`: Session expired / invalid token, or password under 8 characters.

---

### 7. Change Password
Allows an authenticated user to change their password by verifying their current password.

- **HTTP Method**: `POST`
- **Path**: `/api/auth/change-password`
- **Authentication**: Required (JWT Bearer Token)
- **Request Body**:
  - `currentPassword` (string, required): User's current password.
  - `newPassword` (string, required): User's new password (minimum length 8 characters).
  - `confirmNewPassword` (string, required): Matches `newPassword`.

#### Example Request
```json
POST /api/auth/change-password
{
  "currentPassword": "securepassword123",
  "newPassword": "newsecurepassword123",
  "confirmNewPassword": "newsecurepassword123"
}
```

#### Example Response (`201 Created`)
```json
{
  "message": "Password changed successfully."
}
```

- **Error Responses**:
  - `400 Bad Request`: New passwords do not match, or password under 8 characters.
  - `401 Unauthorized`/`400 Bad Request`: Current password incorrect.

---

## Projects Endpoints

### 1. Create Project
Initializes a new project workspace. The creator is assigned the `ADMIN` role.

- **HTTP Method**: `POST`
- **Path**: `/api/projects`
- **Authentication**: Required (JWT)
- **Request Body**:
  - `name` (string, required): Name of the project.
  - `description` (string, optional): Short summary.
  - `color` (string, optional): Hex color tag (default: `#3b82f6`).

#### Example Request
```json
POST /api/projects
{
  "name": "Apollo Project",
  "description": "Building the Next.js landing page",
  "color": "#10b981"
}
```

#### Example Response (`201 Created`)
```json
{
  "id": "cuid-proj-apollo",
  "name": "Apollo Project",
  "description": "Building the Next.js landing page",
  "color": "#10b981",
  "createdAt": "2026-06-05T10:06:06.000Z",
  "updatedAt": "2026-06-05T10:06:06.000Z"
}
```

---

### 2. List Projects
Retrieves all projects the user belongs to, including computed task completion percentages.

- **HTTP Method**: `GET`
- **Path**: `/api/projects`
- **Authentication**: Required (JWT)

#### Example Response (`200 OK`)
```json
[
  {
    "id": "cuid-proj-apollo",
    "name": "Apollo Project",
    "description": "Building the Next.js landing page",
    "color": "#10b981",
    "createdAt": "2026-06-05T10:06:06.000Z",
    "updatedAt": "2026-06-05T10:06:06.000Z",
    "completionPercentage": 45,
    "_count": {
      "tasks": 12,
      "members": 3
    }
  }
]
```

---

### 3. Get Dashboard Global Stats
Retrieves overall counts (projects, tasks, assigned tasks, overdue tasks) across all projects the user is a member of.

- **HTTP Method**: `GET`
- **Path**: `/api/projects/dashboard/stats`
- **Authentication**: Required (JWT)

#### Example Response (`200 OK`)
```json
{
  "totalProjects": 4,
  "totalTasks": 28,
  "assignedTasks": 8,
  "overdueTasks": 2
}
```

---

### 4. Get My Assigned Tasks
Retrieves a list of tasks assigned to the current user across all projects.

- **HTTP Method**: `GET`
- **Path**: `/api/projects/tasks/assigned`
- **Authentication**: Required (JWT)

#### Example Response (`200 OK`)
```json
[
  {
    "id": "cuid-task-888",
    "title": "Fix Auth State Lag",
    "description": "Resolve Zustand sync delay on refresh",
    "status": "IN_PROGRESS",
    "priority": "HIGH",
    "projectId": "cuid-proj-apollo",
    "assigneeId": "cuid-user-123",
    "creatorId": "cuid-user-admin",
    "dueDate": "2026-06-12T18:00:00.000Z",
    "order": 1,
    "createdAt": "2026-06-05T10:06:06.000Z",
    "updatedAt": "2026-06-05T10:06:06.000Z",
    "project": {
      "name": "Apollo Project",
      "color": "#10b981"
    },
    "_count": {
      "comments": 3
    }
  }
]
```

---

### 5. Get Project Details
Retrieves details of a single project, including full member details.

- **HTTP Method**: `GET`
- **Path**: `/api/projects/:id`
- **Authentication**: Required (JWT. Requesting user must be a member of the project)

#### Example Response (`200 OK`)
```json
{
  "id": "cuid-proj-apollo",
  "name": "Apollo Project",
  "description": "Building the Next.js landing page",
  "color": "#10b981",
  "createdAt": "2026-06-05T10:06:06.000Z",
  "updatedAt": "2026-06-05T10:06:06.000Z",
  "members": [
    {
      "id": "cuid-member-rec",
      "userId": "cuid-user-123",
      "projectId": "cuid-proj-apollo",
      "role": "ADMIN",
      "joinedAt": "2026-06-05T10:06:06.000Z",
      "user": {
        "id": "cuid-user-123",
        "displayName": "Jane Doe",
        "email": "jane@example.com",
        "avatarUrl": null
      }
    }
  ],
  "_count": {
    "tasks": 12,
    "members": 1
  }
}
```

---

### 6. Get Project Statistics
Retrieves status distribution, priorities, and upcoming tasks in the next 7 days.

- **HTTP Method**: `GET`
- **Path**: `/api/projects/:id/stats`
- **Authentication**: Required (JWT. User must be a member)

#### Example Response (`200 OK`)
```json
{
  "totalTasks": 12,
  "completedTasks": 3,
  "inProgressTasks": 4,
  "pendingTasks": 9,
  "completionPercentage": 42,
  "priority": {
    "LOW": 4,
    "MEDIUM": 6,
    "HIGH": 2
  },
  "recentActivities": [],
  "upcomingTasks": []
}
```

---

### 7. Update Project
Modifies general settings.

- **HTTP Method**: `PATCH`
- **Path**: `/api/projects/:id`
- **Authentication**: Required (JWT. Authorized only for `ADMIN` role)
- **Request Body**:
  - `name` (string, optional)
  - `description` (string, optional)
  - `color` (string, optional)

---

### 8. Delete Project
Permanently deletes a project and cascades deletion to all members, tasks, and image records.

- **HTTP Method**: `DELETE`
- **Path**: `/api/projects/:id`
- **Authentication**: Required (JWT. Authorized only for `ADMIN` role)

---

## Project Members Endpoints

### 1. Add / Invite Member
Adds a registered user into a project.

- **HTTP Method**: `POST`
- **Path**: `/api/projects/:id/members`
- **Authentication**: Required (JWT. Authorized only for project `ADMIN`)
- **Request Body**:
  - `email` (string, required): Registered user's email.
  - `role` (enum `ADMIN` | `MEMBER` | `VIEWER`, required)

#### Example Request
```json
POST /api/projects/cuid-proj-apollo/members
{
  "email": "team@example.com",
  "role": "MEMBER"
}
```

#### Example Response (`201 Created`)
```json
{
  "id": "cuid-member-rec-2",
  "userId": "cuid-user-helper",
  "projectId": "cuid-proj-apollo",
  "role": "MEMBER",
  "joinedAt": "2026-06-05T10:06:06.000Z",
  "user": {
    "id": "cuid-user-helper",
    "displayName": "Alex Helper",
    "email": "team@example.com",
    "avatarUrl": null
  }
}
```

---

### 2. Update Member Role
Modifies user access level.

- **HTTP Method**: `PATCH`
- **Path**: `/api/projects/:id/members/:memberId`
- **Authentication**: Required (JWT. Authorized only for project `ADMIN`)
- **Request Body**:
  - `role` (enum `ADMIN` | `MEMBER` | `VIEWER`, required)

---

### 3. Remove Member
Kicks a member out of a project. Note: prevents self-removal if the member is the last `ADMIN`.

- **HTTP Method**: `DELETE`
- **Path**: `/api/projects/:id/members/:memberId`
- **Authentication**: Required (JWT. Authorized only for project `ADMIN`)

---

## Tasks Endpoints

### 1. Create Task
Adds a task.

- **HTTP Method**: `POST`
- **Path**: `/api/projects/:projectId/tasks`
- **Authentication**: Required (JWT. Creator must be `ADMIN` or `MEMBER`)
- **Request Body**:
  - `title` (string, required)
  - `description` (string, optional)
  - `status` (enum `TODO` | `IN_PROGRESS` | `REVIEW` | `COMPLETED`, optional)
  - `priority` (enum `LOW` | `MEDIUM` | `HIGH`, optional)
  - `assigneeId` (string, optional)
  - `dueDate` (ISO-8601 string, optional)

#### Example Request
```json
POST /api/projects/cuid-proj-apollo/tasks
{
  "title": "Write API documentation",
  "description": "Complete Markdown file for the API routes",
  "status": "TODO",
  "priority": "HIGH",
  "dueDate": "2026-06-08T17:00:00.000Z"
}
```

#### Example Response (`201 Created`)
```json
{
  "id": "cuid-task-001",
  "title": "Write API documentation",
  "description": "Complete Markdown file for the API routes",
  "status": "TODO",
  "priority": "HIGH",
  "projectId": "cuid-proj-apollo",
  "assigneeId": null,
  "creatorId": "cuid-user-123",
  "dueDate": "2026-06-08T17:00:00.000Z",
  "order": 0,
  "createdAt": "2026-06-05T10:06:06.000Z",
  "updatedAt": "2026-06-05T10:06:06.000Z",
  "assignee": null,
  "creator": {
    "id": "cuid-user-123",
    "displayName": "Jane Doe",
    "email": "jane@example.com",
    "avatarUrl": null
  }
}
```

---

### 2. List Tasks (with Search and Cursor-based Pagination)
Lists tasks belonging to the project. Supports searching and cursor-based pagination.

- **HTTP Method**: `GET`
- **Path**: `/api/projects/:projectId/tasks`
- **Authentication**: Required (JWT. User must be a project member)
- **Query Parameters**:
  - `status` (enum `TODO` | `IN_PROGRESS` | `REVIEW` | `COMPLETED`, optional)
  - `assigneeId` (string, optional)
  - `search` (string, optional): Filter by title (case-insensitive contains match).
  - `cursor` (string, optional): Task ID indicating from which record to paginate.
  - `limit` (string/number, optional): Number of tasks to fetch (default: `50`).

---

### 3. Get Task Details
Retrieves details for a single task including assignee, creator, and full comments array.

- **HTTP Method**: `GET`
- **Path**: `/api/projects/:projectId/tasks/:taskId`
- **Authentication**: Required (JWT. User must be a member)

---

### 4. Update Task (with Optimistic Concurrency Check)
Modifies a task's details.

- **HTTP Method**: `PATCH`
- **Path**: `/api/projects/:projectId/tasks/:taskId`
- **Authentication**: Required (JWT. User must be project `ADMIN` or `MEMBER`)
- **Request Body**:
  - `title` (string, optional)
  - `description` (string, optional)
  - `status` (enum `TODO` | `IN_PROGRESS` | `REVIEW` | `COMPLETED`, optional)
  - `priority` (enum `LOW` | `MEDIUM` | `HIGH`, optional)
  - `assigneeId` (string, optional, nullable)
  - `dueDate` (ISO-8601 string, optional, nullable)
  - `lastKnownUpdatedAt` (ISO-8601 string, optional): The timestamp of the task when loaded by the client. Used to verify that no intermediate modification occurred.

#### Example Request
```json
PATCH /api/projects/cuid-proj-apollo/tasks/cuid-task-001
{
  "status": "IN_PROGRESS",
  "lastKnownUpdatedAt": "2026-06-05T10:06:06.000Z"
}
```

#### Example Concurrency Conflict Error Response (`409 Conflict`)
If the task was updated on the server after the client loaded it (comparing `lastKnownUpdatedAt` against database `updatedAt`), the request returns:
```json
{
  "statusCode": 409,
  "message": "Task has been updated by another user",
  "path": "/api/projects/cuid-proj-apollo/tasks/cuid-task-001",
  "timestamp": "2026-06-05T10:07:00.000Z"
}
```

---

### 5. Delete Task
Deletes a task.

- **HTTP Method**: `DELETE`
- **Path**: `/api/projects/:projectId/tasks/:taskId`
- **Authentication**: Required (JWT. Only project `ADMIN` or the task `creator` can delete a task)

---

## Comments Endpoints

### 1. Post Comment
Adds a text comment to a task.

- **HTTP Method**: `POST`
- **Path**: `/api/tasks/:taskId/comments`
- **Authentication**: Required (JWT. User must be project member)
- **Request Body**:
  - `text` (string, required)

---

### 2. List Task Comments
Lists comments on a task.

- **HTTP Method**: `GET`
- **Path**: `/api/tasks/:taskId/comments`
- **Authentication**: Required (JWT. User must be project member)

---

### 3. Update Comment
Edits user's own comment text.

- **HTTP Method**: `PATCH`
- **Path**: `/api/comments/:commentId`
- **Authentication**: Required (JWT. Authorized only for the comment creator)
- **Request Body**:
  - `text` (string, required)

---

### 4. Delete Comment
Permanently deletes a comment.

- **HTTP Method**: `DELETE`
- **Path**: `/api/comments/:commentId`
- **Authentication**: Required (JWT. Authorized only for the comment creator)

---

## Activities Endpoints

### 1. List Project Activities
Retrieves a list of up to 50 activities recorded in the project.

- **HTTP Method**: `GET`
- **Path**: `/api/projects/:id/activities`
- **Authentication**: Required (JWT. User must be project member)

---

## Task Images Endpoints

### 1. Upload Task Images
Attaches up to 10 image files to a task.

- **HTTP Method**: `POST`
- **Path**: `/api/tasks/:taskId/images`
- **Authentication**: Required (JWT. User must be `ADMIN` or `MEMBER`)
- **Headers**:
  - `Content-Type: multipart/form-data`
- **Multipart Form Payload**:
  - `images` (File array, required): Supported image files.
- **Constraints**:
  - **Allowed file types**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`.
  - **Maximum file size**: `5 MB` per file.
  - **Maximum quantity**: `10` files per upload request.

#### Example Response (`201 Created`)
```json
[
  {
    "id": "cuid-img-001",
    "taskId": "cuid-task-001",
    "originalName": "mockup.png",
    "storedName": "e551e18f-a9cb-48d6-8488-295b9d3632ab.png",
    "url": "http://localhost:3001/uploads/tasks/e551e18f-a9cb-48d6-8488-295b9d3632ab.png",
    "size": 242100,
    "mimeType": "image/png",
    "uploaderId": "cuid-user-123",
    "createdAt": "2026-06-05T10:06:06.000Z"
  }
]
```

---

### 2. Get Task Images
Retrieves all images associated with a task.

- **HTTP Method**: `GET`
- **Path**: `/api/tasks/:taskId/images`
- **Authentication**: Required (JWT. User must be project member)

---

### 3. Delete Task Image
Removes the image attachment. Deletes the physical file from local disk.

- **HTTP Method**: `DELETE`
- **Path**: `/api/images/:imageId`
- **Authentication**: Required (JWT. Authorized only for the **uploader** of the image or project **ADMIN**)
