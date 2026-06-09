# Task Tracker REST API Documentation

This document covers all REST API endpoints available in the Task Tracker backend.

All routes are prefixed with `/api`. Authenticated endpoints require a Bearer token in the `Authorization` header:
`Authorization: Bearer <JWT_TOKEN>`

---

## Table of Contents
1. [Authentication Endpoints](#authentication-endpoints)
2. [Profile Endpoints](#profile-endpoints)
3. [Projects Endpoints](#projects-endpoints)
4. [Project Members Endpoints](#project-members-endpoints)
5. [Labels Endpoints](#labels-endpoints)
6. [Tasks Endpoints](#tasks-endpoints)
7. [Comments & Reactions Endpoints](#comments--reactions-endpoints)
8. [Task Images Endpoints](#task-images-endpoints)
9. [Activities Endpoints](#activities-endpoints)

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
  - `401 Unauthorized`: Invalid credentials.

---

### 3. Get Current User Profile
Retrieves authenticated user metadata.
- **HTTP Method**: `GET`
- **Path**: `/api/auth/me`
- **Authentication**: Required (JWT)

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
  - `email` (string, required)

#### Example Response (`201 Created`)
```json
{
  "message": "If an account with that email exists, a 6-digit code has been sent. It expires in 15 minutes."
}
```

---

### 5. Verify Password Reset OTP
Verifies the 6-digit OTP and returns a short-lived verification token.
- **HTTP Method**: `POST`
- **Path**: `/api/auth/verify-otp`
- **Authentication**: None
- **Request Body**:
  - `email` (string, required)
  - `code` (string, required): 6-digit OTP code.

#### Example Response (`201 Created`)
```json
{
  "verificationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 6. Set New Password
Uses the verification token to securely set a new password.
- **HTTP Method**: `POST`
- **Path**: `/api/auth/set-new-password`
- **Authentication**: None
- **Request Body**:
  - `verificationToken` (string, required)
  - `newPassword` (string, required): Minimum length 8 characters.

#### Example Response (`201 Created`)
```json
{
  "message": "Your password has been reset successfully."
}
```

---

### 7. Change Password
Allows an authenticated user to change their password by verifying their current password.
- **HTTP Method**: `POST`
- **Path**: `/api/auth/change-password`
- **Authentication**: Required (JWT)
- **Request Body**:
  - `currentPassword` (string, required)
  - `newPassword` (string, required): Minimum length 8 characters.
  - `confirmNewPassword` (string, required): Matches `newPassword`.

#### Example Response (`201 Created`)
```json
{
  "message": "Password changed successfully."
}
```

---

## Profile Endpoints

### 1. Get Profile
Retrieves the logged-in user's profile information.
- **HTTP Method**: `GET`
- **Path**: `/api/profile`
- **Authentication**: Required (JWT)

#### Example Response (`200 OK`)
```json
{
  "id": "cuid-user-123",
  "email": "jane@example.com",
  "displayName": "Jane Doe",
  "avatarUrl": "http://localhost:3001/uploads/avatars/uuid-avatar.jpg",
  "createdAt": "2026-06-05T10:06:06.000Z"
}
```

---

### 2. Update Profile
Modifies user profile settings (name/email). Validates email uniqueness.
- **HTTP Method**: `PATCH`
- **Path**: `/api/profile`
- **Authentication**: Required (JWT)
- **Request Body**:
  - `displayName` (string, optional)
  - `email` (string, optional)

#### Example Request
```json
{
  "displayName": "Jane D. Smith",
  "email": "jane.smith@example.com"
}
```
#### Example Response (`200 OK`)
```json
{
  "id": "cuid-user-123",
  "email": "jane.smith@example.com",
  "displayName": "Jane D. Smith",
  "avatarUrl": null
}
```

---

### 3. Upload Profile Avatar
Uploads a custom profile picture. Overwrites/deletes the previous avatar file on disk if it exists.
- **HTTP Method**: `POST`
- **Path**: `/api/profile/avatar`
- **Authentication**: Required (JWT)
- **Headers**:
  - `Content-Type: multipart/form-data`
- **Payload**:
  - `avatar` (File, required): The image file.
- **File constraints**:
  - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`.
  - Max size: `2 MB`.

#### Example Response (`201 Created`)
```json
{
  "avatarUrl": "http://localhost:3001/uploads/avatars/4172f8a8-b98a-45c1-92ea-2a9010abccde.jpg"
}
```

---

### 4. Delete Profile Avatar
Removes the profile avatar and deletes the physical file from disk.
- **HTTP Method**: `DELETE`
- **Path**: `/api/profile/avatar`
- **Authentication**: Required (JWT)

#### Example Response (`200 OK`)
```json
{
  "message": "Avatar removed successfully."
}
```

---

## Projects Endpoints

### 1. Create Project
Initializes a new project workspace. The creator is assigned the `ADMIN` role.
- **HTTP Method**: `POST`
- **Path**: `/api/projects`
- **Authentication**: Required (JWT)
- **Request Body**:
  - `name` (string, required)
  - `description` (string, optional)
  - `color` (string, optional)

#### Example Request
```json
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
Retrieves all projects the user belongs to, including completion percentages.
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

### 3. Get Project Details
Retrieves details of a single project, including full member details.
- **HTTP Method**: `GET`
- **Path**: `/api/projects/:id`
- **Authentication**: Required (JWT. User must be a member)

---

### 4. Update Project
Modifies project name, description, or color.
- **HTTP Method**: `PATCH`
- **Path**: `/api/projects/:id`
- **Authentication**: Required (JWT. Only project `ADMIN`)
- **Request Body**:
  - `name` (string, optional)
  - `description` (string, optional)
  - `color` (string, optional)

---

### 5. Delete Project
Permanently deletes a project and cascades deletion to all members, tasks, and image records.
- **HTTP Method**: `DELETE`
- **Path**: `/api/projects/:id`
- **Authentication**: Required (JWT. Only project `ADMIN` owner)

---

### 6. Get Project Statistics
Retrieves status distribution, priorities, and upcoming tasks in the next 7 days.
- **HTTP Method**: `GET`
- **Path**: `/api/projects/:id/stats`
- **Authentication**: Required (JWT. User must be a member)

---

### 7. Export Project as CSV
Generates and downloads a CSV export containing structured sections of Tasks, Comments, and Project Activities.
- **HTTP Method**: `GET`
- **Path**: `/api/projects/:projectId/export/csv`
- **Authentication**: Required (JWT. User must be a member)
- **Response Headers**:
  - `Content-Type: text/csv`
  - `Content-Disposition: attachment; filename="project-export-[id]-[timestamp].csv"`

#### Example Request
`GET /api/projects/cuid-proj-apollo/export/csv`

---

### 8. Export Project as PDF
Generates and downloads a high-fidelity PDF document containing a Cover page, Tasks tabular summary, Comments, and Activity Timeline logs.
- **HTTP Method**: `GET`
- **Path**: `/api/projects/:projectId/export/pdf`
- **Authentication**: Required (JWT. User must be a member)
- **Response Headers**:
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="project-export-[id]-[timestamp].pdf"`

#### Example Request
`GET /api/projects/cuid-proj-apollo/export/pdf`

---

## Project Members Endpoints

### 1. Add / Invite Member
Adds a registered user into a project.
- **HTTP Method**: `POST`
- **Path**: `/api/projects/:id/members`
- **Authentication**: Required (JWT. Only project `ADMIN`)
- **Request Body**:
  - `email` (string, required)
  - `role` (enum `ADMIN` | `MEMBER` | `VIEWER`, required)

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
Modifies member access level.
- **HTTP Method**: `PATCH`
- **Path**: `/api/projects/:id/members/:memberId`
- **Authentication**: Required (JWT. Only project `ADMIN`)
- **Request Body**:
  - `role` (enum `ADMIN` | `MEMBER` | `VIEWER`, required)

---

### 3. Remove Member
Kicks a member out of a project. Prevents removing the last admin.
- **HTTP Method**: `DELETE`
- **Path**: `/api/projects/:id/members/:memberId`
- **Authentication**: Required (JWT. Only project `ADMIN`)

---

## Labels Endpoints

### 1. Create Label
Creates a custom label tag within a project.
- **HTTP Method**: `POST`
- **Path**: `/api/projects/:projectId/labels`
- **Authentication**: Required (JWT. Only project `ADMIN`)
- **Request Body**:
  - `name` (string, required)
  - `color` (string, required): Hex color code.

#### Example Response (`201 Created`)
```json
{
  "id": "cuid-lbl-001",
  "name": "Bug",
  "color": "#ef4444",
  "projectId": "cuid-proj-apollo",
  "createdAt": "2026-06-05T10:06:06.000Z"
}
```

---

### 2. List Labels
Lists all labels defined for a project.
- **HTTP Method**: `GET`
- **Path**: `/api/projects/:projectId/labels`
- **Authentication**: Required (JWT. User must be a member)

---

### 3. Update Label
Modifies a label's name or color.
- **HTTP Method**: `PATCH`
- **Path**: `/api/labels/:labelId`
- **Authentication**: Required (JWT. Only project `ADMIN`)
- **Request Body**:
  - `name` (string, optional)
  - `color` (string, optional)

---

### 4. Delete Label
Deletes a label. Automatically unlinks it from all tasks.
- **HTTP Method**: `DELETE`
- **Path**: `/api/labels/:labelId`
- **Authentication**: Required (JWT. Only project `ADMIN`)

---

### 5. Add Label to Task
Attaches a label to a task.
- **HTTP Method**: `POST`
- **Path**: `/api/tasks/:taskId/labels`
- **Authentication**: Required (JWT. User must be project `ADMIN` or `MEMBER`)
- **Request Body**:
  - `labelId` (string, required)

#### Example Response (`201 Created`)
```json
{
  "id": "cuid-task-lbl-link",
  "taskId": "cuid-task-001",
  "labelId": "cuid-lbl-001"
}
```

---

### 6. Remove Label from Task
Detaches a label from a task.
- **HTTP Method**: `DELETE`
- **Path**: `/api/tasks/:taskId/labels/:labelId`
- **Authentication**: Required (JWT. User must be project `ADMIN` or `MEMBER`)

---

## Tasks Endpoints

### 1. Create Task
Adds a task to a project.
- **HTTP Method**: `POST`
- **Path**: `/api/projects/:projectId/tasks`
- **Authentication**: Required (JWT. User must be project `ADMIN` or `MEMBER`)
- **Request Body**:
  - `title` (string, required)
  - `description` (string, optional)
  - `status` (enum `TODO` | `IN_PROGRESS` | `REVIEW` | `COMPLETED`, optional)
  - `priority` (enum `LOW` | `MEDIUM` | `HIGH`, optional)
  - `assigneeId` (string, optional)
  - `dueDate` (ISO-8601 string, optional)

#### Example Request
```json
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
  "updatedAt": "2026-06-05T10:06:06.000Z"
}
```

---

### 2. List Tasks
Lists tasks. Supports cursor-based infinite pagination, status/assignee filtering, and text searches.
- **HTTP Method**: `GET`
- **Path**: `/api/projects/:projectId/tasks`
- **Authentication**: Required (JWT. User must be a member)
- **Query Parameters**:
  - `status` (enum, optional)
  - `assigneeId` (string, optional)
  - `search` (string, optional)
  - `cursor` (string, optional)
  - `limit` (string/number, optional, default: 50)

---

### 3. Get Task Details
Retrieves details for a single task.
- **HTTP Method**: `GET`
- **Path**: `/api/projects/:projectId/tasks/:taskId`
- **Authentication**: Required (JWT. User must be a member)

---

### 4. Update Task (with Concurrency Checks)
Modifies a task. Enforces optimistic concurrency checks via `lastKnownUpdatedAt` and task dependency checks if shifting status to `IN_PROGRESS`.
- **HTTP Method**: `PATCH`
- **Path**: `/api/projects/:projectId/tasks/:taskId`
- **Authentication**: Required (JWT. User must be project `ADMIN` or `MEMBER`)
- **Request Body**:
  - `title` (string, optional)
  - `description` (string, optional)
  - `status` (enum, optional)
  - `priority` (enum, optional)
  - `assigneeId` (string, optional, nullable)
  - `dueDate` (ISO-8601 string, optional, nullable)
  - `lastKnownUpdatedAt` (ISO-8601 string, optional)

---

### 5. Delete Task
Deletes a task.
- **HTTP Method**: `DELETE`
- **Path**: `/api/projects/:projectId/tasks/:taskId`
- **Authentication**: Required (JWT. Only project `ADMIN` or the task `creator`)

---

### 6. Get Task Dependencies
Retrieves the list of blocking and blocked-by dependencies for a task.
- **HTTP Method**: `GET`
- **Path**: `/api/tasks/:taskId/dependencies`
- **Authentication**: Required (JWT. User must be a member)

#### Example Response (`200 OK`)
```json
{
  "blockedBy": [
    {
      "id": "cuid-task-002",
      "title": "Set up Database",
      "status": "TODO"
    }
  ],
  "blocking": []
}
```

---

### 7. Add Task Dependency
Establishes a blocking relationship from one task to another. Performs circular dependency DFS traversal.
- **HTTP Method**: `POST`
- **Path**: `/api/tasks/:taskId/dependencies`
- **Authentication**: Required (JWT. User must be project `ADMIN` or `MEMBER`)
- **Request Body**:
  - `blockedByTaskId` (string, required): The task ID that blocks the current task.

#### Example Request
```json
{
  "blockedByTaskId": "cuid-task-002"
}
```
#### Example Response (`201 Created`)
```json
{
  "id": "cuid-dependency-link",
  "taskId": "cuid-task-001",
  "blockedByTaskId": "cuid-task-002",
  "createdAt": "2026-06-05T10:06:06.000Z"
}
```

---

### 8. Remove Task Dependency
Deletes a blocking relationship between tasks.
- **HTTP Method**: `DELETE`
- **Path**: `/api/tasks/:taskId/dependencies/:blockedByTaskId`
- **Authentication**: Required (JWT. User must be project `ADMIN` or `MEMBER`)

---

### 9. Get Task History (Audit Log)
Retrieves the list of updates recorded for a specific task.
- **HTTP Method**: `GET`
- **Path**: `/api/tasks/:taskId/history`
- **Authentication**: Required (JWT. User must be a member)

#### Example Response (`200 OK`)
```json
[
  {
    "id": "cuid-act-001",
    "type": "STATUS_CHANGED",
    "projectId": "cuid-proj-apollo",
    "userId": "cuid-user-123",
    "taskId": "cuid-task-001",
    "metadata": {
      "oldStatus": "TODO",
      "newStatus": "IN_PROGRESS"
    },
    "createdAt": "2026-06-05T10:06:06.000Z",
    "user": {
      "displayName": "Jane Doe"
    }
  }
]
```

---

## Comments & Reactions Endpoints

### 1. Post Comment
Adds a text comment to a task.
- **HTTP Method**: `POST`
- **Path**: `/api/tasks/:taskId/comments`
- **Authentication**: Required (JWT. User must be a member)
- **Request Body**:
  - `text` (string, required)

---

### 2. List Task Comments
Lists comments on a task, including user metadata and emoji reactions.
- **HTTP Method**: `GET`
- **Path**: `/api/tasks/:taskId/comments`
- **Authentication**: Required (JWT. User must be a member)

---

### 3. Update Comment
Edits user's own comment text.
- **HTTP Method**: `PATCH`
- **Path**: `/api/comments/:commentId`
- **Authentication**: Required (JWT. Only comment creator)
- **Request Body**:
  - `text` (string, required)

---

### 4. Delete Comment
Permanently deletes a comment.
- **HTTP Method**: `DELETE`
- **Path**: `/api/comments/:commentId`
- **Authentication**: Required (JWT. Comment creator or project `ADMIN`)

---

### 5. Toggle Comment Reaction
Toggles an emoji reaction on a comment. If the user has already reacted with the specified emoji, it is removed; otherwise, it is added.
- **HTTP Method**: `POST`
- **Path**: `/api/comments/:commentId/reactions`
- **Authentication**: Required (JWT. User must be a member)
- **Request Body**:
  - `emoji` (string, required): Unicode emoji character.

#### Example Request
```json
{
  "emoji": "👍"
}
```
#### Example Response (`201 Created`)
```json
[
  {
    "id": "cuid-react-001",
    "commentId": "cuid-comm-001",
    "userId": "cuid-user-123",
    "emoji": "👍",
    "createdAt": "2026-06-05T10:06:06.000Z"
  }
]
```

---

## Task Images Endpoints

### 1. Upload Task Images
Attaches up to 10 image files to a task.
- **HTTP Method**: `POST`
- **Path**: `/api/tasks/:taskId/images`
- **Authentication**: Required (JWT. User must be project `ADMIN` or `MEMBER`)
- **Headers**:
  - `Content-Type: multipart/form-data`
- **Payload**:
  - `images` (File array, required): The image files.
- **File constraints**:
  - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`.
  - Max size: `5 MB` per file.
  - Max quantity: `10` files per request.

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
- **Authentication**: Required (JWT. User must be a member)

---

### 3. Delete Task Image
Removes the image attachment. Deletes the file from local disk.
- **HTTP Method**: `DELETE`
- **Path**: `/api/images/:imageId`
- **Authentication**: Required (JWT. Only image uploader or project `ADMIN`)

---

## Activities Endpoints

### 1. List Project Activities
Retrieves a list of up to 50 activities recorded in the project.
- **HTTP Method**: `GET`
- **Path**: `/api/projects/:id/activities`
- **Authentication**: Required (JWT. User must be a member)
