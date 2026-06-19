# Task Tracker REST API Documentation

This document covers all REST API endpoints available in the Task Tracker backend.

All routes are prefixed with `/api` (except `/health`). Authenticated endpoints require a Bearer token in the `Authorization` header:
`Authorization: Bearer <JWT_TOKEN>`

---

## Table of Contents
1. [Authentication Endpoints](#1-authentication-endpoints)
2. [Profile Endpoints](#2-profile-endpoints)
3. [Projects Endpoints](#3-projects-endpoints)
4. [Project Members Endpoints](#4-project-members-endpoints)
5. [Labels Endpoints](#5-labels-endpoints)
6. [Tasks Endpoints](#6-tasks-endpoints)
7. [Comments & Reactions Endpoints](#7-comments--reactions-endpoints)
8. [Task Images Endpoints](#8-task-images-endpoints)
9. [Activities Endpoints](#9-activities-endpoints)
10. [Notifications Endpoints](#10-notifications-endpoints)
11. [Chat (Channels & Messages) Endpoints](#11-chat-channels--messages-endpoints)
12. [Project Files Endpoints](#12-project-files-endpoints)
13. [Search Endpoints](#13-search-endpoints)
14. [Health Check Endpoint](#14-health-check-endpoint)

---

## 1. Authentication Endpoints

### 1. User Registration
Creates a new user account.
- **HTTP Method**: `POST`
- **Path**: `/api/auth/register`
- **Authentication**: None (Rate limit: 5 requests per minute)
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
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 2. User Login
Authenticates an existing user and issues access/refresh tokens.
- **HTTP Method**: `POST`
- **Path**: `/api/auth/login`
- **Authentication**: None (Rate limit: 5 requests per minute)
- **Request Body**:
  - `email` (string, required)
  - `password` (string, required)

#### Example Response (`201 Created`)
```json
{
  "user": {
    "id": "cuid-user-123",
    "email": "jane@example.com",
    "displayName": "Jane Doe",
    "avatarUrl": null
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 3. Session Token Refresh
Rotates current refresh token to issue a new access/refresh token pair.
- **HTTP Method**: `POST`
- **Path**: `/api/auth/refresh`
- **Authentication**: None (Rate limit: 10 requests per minute)
- **Request Body**:
  - `refreshToken` (string, required): The active refresh token.

#### Example Response (`201 Created`)
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 4. User Logout
Invalidates the submitted refresh token family, logging the user out.
- **HTTP Method**: `POST`
- **Path**: `/api/auth/logout`
- **Authentication**: None
- **Request Body**:
  - `refreshToken` (string, required): The active refresh token.

#### Example Response (`201 Created`)
```json
{
  "success": true
}
```

---

### 5. Get Current User Profile
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
  "updatedAt": "2026-06-05T10:06:06.000Z",
  "notifyByEmail": true
}
```

---

### 6. Request Password Reset OTP
Generates a secure 6-digit OTP code and emails it to the user.
- **HTTP Method**: `POST`
- **Path**: `/api/auth/request-otp`
- **Authentication**: None (Rate limit: 3 requests per 15 minutes)
- **Request Body**:
  - `email` (string, required)

#### Example Response (`201 Created`)
```json
{
  "message": "If an account with that email exists, a 6-digit code has been sent. It expires in 15 minutes."
}
```

---

### 7. Verify Password Reset OTP
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

### 8. Set New Password
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

### 9. Change Password
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

## 2. Profile Endpoints

### 1. Get Profile
Retrieves the logged-in user's profile information.
- **HTTP Method**: `GET`
- **Path**: `/api/profile`
- **Authentication**: Required (JWT)

---

### 2. Update Profile
Modifies user profile settings (name/email) and toggles email notification preferences.
- **HTTP Method**: `PATCH`
- **Path**: `/api/profile`
- **Authentication**: Required (JWT)
- **Request Body**:
  - `displayName` (string, optional)
  - `email` (string, optional)
  - `notifyByEmail` (boolean, optional)

---

### 3. Upload Profile Avatar
Uploads a custom profile picture. Overwrites/deletes the previous avatar file on disk.
- **HTTP Method**: `POST`
- **Path**: `/api/profile/avatar`
- **Authentication**: Required (JWT)
- **Headers**:
  - `Content-Type: multipart/form-data`
- **Payload**:
  - `avatar` (File, required): Max size `2 MB`, JPEG/PNG/WebP.

---

### 4. Delete Profile Avatar
Removes the profile avatar and deletes the physical file from disk.
- **HTTP Method**: `DELETE`
- **Path**: `/api/profile/avatar`
- **Authentication**: Required (JWT)

---

## 3. Projects Endpoints

### 1. Create Project
Initializes a new project workspace. The creator is assigned the `ADMIN` role.
- **HTTP Method**: `POST`
- **Path**: `/api/projects`
- **Authentication**: Required (JWT)
- **Request Body**:
  - `name` (string, required)
  - `description` (string, optional)
  - `color` (string, optional)

---

### 2. List Projects
Retrieves all projects the user belongs to, including completion percentages.
- **HTTP Method**: `GET`
- **Path**: `/api/projects`
- **Authentication**: Required (JWT)

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
Generates and downloads a CSV export.
- **HTTP Method**: `GET`
- **Path**: `/api/projects/:projectId/export/csv`
- **Authentication**: Required (JWT. User must be a member)

---

### 8. Export Project as PDF
Generates and downloads a high-fidelity PDF document.
- **HTTP Method**: `GET`
- **Path**: `/api/projects/:projectId/export/pdf`
- **Authentication**: Required (JWT. User must be a member)

---

### 9. Get Dashboard Statistics
Retrieves counts of projects, tasks, assigned tasks, and overdue tasks.
- **HTTP Method**: `GET`
- **Path**: `/api/projects/dashboard/stats`
- **Authentication**: Required (JWT)

---

### 10. Get User Assigned Tasks
Retrieves all tasks assigned to the authenticated user across all projects.
- **HTTP Method**: `GET`
- **Path**: `/api/projects/tasks/assigned`
- **Authentication**: Required (JWT)

---

## 4. Project Members Endpoints

### 1. Add / Invite Member
Adds a registered user into a project.
- **HTTP Method**: `POST`
- **Path**: `/api/projects/:id/members`
- **Authentication**: Required (JWT. Only project `ADMIN`)
- **Request Body**:
  - `email` (string, required)
  - `role` (enum `ADMIN` | `MEMBER` | `MANAGER`, required)

---

### 2. Update Member Role
Modifies member access level.
- **HTTP Method**: `PATCH`
- **Path**: `/api/projects/:id/members/:memberId`
- **Authentication**: Required (JWT. Only project `ADMIN`)
- **Request Body**:
  - `role` (enum `ADMIN` | `MEMBER` | `MANAGER`, required)

---

### 3. Remove Member
Kicks a member out of a project.
- **HTTP Method**: `DELETE`
- **Path**: `/api/projects/:id/members/:memberId`
- **Authentication**: Required (JWT. Only project `ADMIN`)

---

## 5. Labels Endpoints

### 1. Create Label
Creates a custom label tag within a project.
- **HTTP Method**: `POST`
- **Path**: `/api/projects/:projectId/labels`
- **Authentication**: Required (JWT. Only project `ADMIN`)

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

---

### 4. Delete Label
Deletes a label.
- **HTTP Method**: `DELETE`
- **Path**: `/api/labels/:labelId`
- **Authentication**: Required (JWT. Only project `ADMIN`)

---

### 5. Add Label to Task
Attaches a label to a task.
- **HTTP Method**: `POST`
- **Path**: `/api/tasks/:taskId/labels`
- **Authentication**: Required (JWT. User must be project `ADMIN`, `MANAGER`, or `MEMBER`)

---

### 6. Remove Label from Task
Detaches a label from a task.
- **HTTP Method**: `DELETE`
- **Path**: `/api/tasks/:taskId/labels/:labelId`
- **Authentication**: Required (JWT. User must be project `ADMIN`, `MANAGER`, or `MEMBER`)

---

## 6. Tasks Endpoints

### 1. Create Task
Adds a task to a project.
- **HTTP Method**: `POST`
- **Path**: `/api/projects/:projectId/tasks`
- **Authentication**: Required (JWT. User must be project `ADMIN`, `MANAGER`, or `MEMBER`)

---

### 2. List Tasks
Lists tasks. Supports cursor-based infinite pagination, status/assignee filtering, and text searches.
- **HTTP Method**: `GET`
- **Path**: `/api/projects/:projectId/tasks`
- **Authentication**: Required (JWT. User must be a member)

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
- **Authentication**: Required (JWT. User must be project `ADMIN`, `MANAGER`, or `MEMBER`)

---

### 5. Delete Task
Deletes a task.
- **HTTP Method**: `DELETE`
- **Path**: `/api/projects/:projectId/tasks/:taskId`
- **Authentication**: Required (JWT. Only project `ADMIN`, `MANAGER`, or the task `creator`)

---

### 6. Get Task Dependencies
Retrieves the list of blocking and blocked-by dependencies for a task.
- **HTTP Method**: `GET`
- **Path**: `/api/tasks/:taskId/dependencies`
- **Authentication**: Required (JWT. User must be a member)

---

### 7. Add Task Dependency
Establishes a blocking relationship from one task to another. Performs circular dependency DFS traversal.
- **HTTP Method**: `POST`
- **Path**: `/api/tasks/:taskId/dependencies`
- **Authentication**: Required (JWT. User must be project `ADMIN`, `MANAGER`, or `MEMBER`)

---

### 8. Remove Task Dependency
Deletes a blocking relationship between tasks.
- **HTTP Method**: `DELETE`
- **Path**: `/api/tasks/:taskId/dependencies/:blockedByTaskId`
- **Authentication**: Required (JWT. User must be project `ADMIN`, `MANAGER`, or `MEMBER`)

---

### 9. Get Task History (Audit Log)
Retrieves the list of updates recorded for a specific task.
- **HTTP Method**: `GET`
- **Path**: `/api/tasks/:taskId/history`
- **Authentication**: Required (JWT. User must be a member)

---

## 7. Comments & Reactions Endpoints

### 1. Post Comment
Adds a text comment to a task.
- **HTTP Method**: `POST`
- **Path**: `/api/tasks/:taskId/comments`
- **Authentication**: Required (JWT. User must be a member)

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

---

### 4. Delete Comment
Permanently deletes a comment.
- **HTTP Method**: `DELETE`
- **Path**: `/api/comments/:commentId`
- **Authentication**: Required (JWT. Comment creator or project `ADMIN`, `MANAGER`)

---

### 5. Toggle Comment Reaction
Toggles an emoji reaction on a comment.
- **HTTP Method**: `POST`
- **Path**: `/api/comments/:commentId/reactions`
- **Authentication**: Required (JWT. User must be a member)

---

### 6. List Comment Reactions
Retrieves emoji reactions left on a comment, grouped by emoji character.
- **HTTP Method**: `GET`
- **Path**: `/api/comments/:commentId/reactions`
- **Authentication**: Required (JWT. User must be a member)

---

## 8. Task Images Endpoints

### 1. Upload Task Images
Attaches up to 10 image files to a task.
- **HTTP Method**: `POST`
- **Path**: `/api/tasks/:taskId/images`
- **Authentication**: Required (JWT. User must be project `ADMIN`, `MANAGER`, or `MEMBER`)
- **Headers**:
  - `Content-Type: multipart/form-data`
- **Payload**:
  - `images` (File array, required): Max size `5 MB` per file, JPEG/PNG/WebP/GIF.

---

### 2. Get Task Images
Retrieves all images associated with a task.
- **HTTP Method**: `GET`
- **Path**: `/api/tasks/:taskId/images`
- **Authentication**: Required (JWT. User must be a member)

---

### 3. Delete Task Image
Removes the image attachment and deletes the physical file.
- **HTTP Method**: `DELETE`
- **Path**: `/api/images/:imageId`
- **Authentication**: Required (JWT. Only image uploader or project `ADMIN`, `MANAGER`)

---

## 9. Activities Endpoints

### 1. List Project Activities
Retrieves a list of up to 50 activities recorded in the project.
- **HTTP Method**: `GET`
- **Path**: `/api/projects/:id/activities`
- **Authentication**: Required (JWT. User must be a member)

---

## 10. Notifications Endpoints

### 1. List Notifications
Retrieves recipient's notifications with cursor-based infinite pagination.
- **HTTP Method**: `GET`
- **Path**: `/api/notifications`
- **Authentication**: Required (JWT)
- **Query Parameters**:
  - `limit` (number, optional, default: 10)
  - `cursor` (string, optional)

---

### 2. Get Unread Notifications Count
Retrieves count of unread notifications for the user.
- **HTTP Method**: `GET`
- **Path**: `/api/notifications/unread-count`
- **Authentication**: Required (JWT)

---

### 3. Mark All Notifications as Read
Marks all notifications for the user as read.
- **HTTP Method**: `PATCH`
- **Path**: `/api/notifications/read-all`
- **Authentication**: Required (JWT)

---

### 4. Mark Single Notification as Read
Marks a specific notification as read.
- **HTTP Method**: `PATCH`
- **Path**: `/api/notifications/:id/read`
- **Authentication**: Required (JWT)

---

## 11. Chat (Channels & Messages) Endpoints

### 1. Get Project General Channel
Retrieves or creates the main default general channel for a project.
- **HTTP Method**: `GET`
- **Path**: `/api/projects/:projectId/channel`
- **Authentication**: Required (JWT. User must be a member)

---

### 2. Create Project Channel
Creates a new public or private channel inside a project.
- **HTTP Method**: `POST`
- **Path**: `/api/projects/:projectId/channels`
- **Authentication**: Required (JWT. User must be a member)
- **Request Body**:
  - `name` (string, required): Channel slug name.
  - `description` (string, optional)
  - `isPrivate` (boolean, optional, default: false)
  - `memberIds` (string[], optional): IDs of initial members for private channels.

---

### 3. List Project Channels
Retrieves all public channels and private channels the user is a member of in a project.
- **HTTP Method**: `GET`
- **Path**: `/api/projects/:projectId/channels`
- **Authentication**: Required (JWT. User must be a member)

---

### 4. Update Channel Info
Modifies a channel's name or description.
- **HTTP Method**: `PATCH`
- **Path**: `/api/channels/:channelId`
- **Authentication**: Required (JWT. User must be project Admin/Manager or the channel creator)

---

### 5. Archive Channel
Archives a channel to prevent new messages (general channels cannot be archived).
- **HTTP Method**: `POST`
- **Path**: `/api/channels/:channelId/archive`
- **Authentication**: Required (JWT. User must be project Admin/Manager or the channel creator)

---

### 6. Unarchive Channel
Restores an archived channel.
- **HTTP Method**: `POST`
- **Path**: `/api/channels/:channelId/unarchive`
- **Authentication**: Required (JWT. User must be project Admin/Manager or the channel creator)

---

### 7. Add Channel Members
Invites users into a private channel.
- **HTTP Method**: `POST`
- **Path**: `/api/channels/:channelId/members`
- **Authentication**: Required (JWT. User must be channel member)
- **Request Body**:
  - `memberIds` (string[], required)

---

### 8. Remove Channel Member
Removes a user from a private channel.
- **HTTP Method**: `DELETE`
- **Path**: `/api/channels/:channelId/members/:targetUserId`
- **Authentication**: Required (JWT. User must be channel member)

---

### 9. List Channel Members
Retrieves the list of users belonging to a channel.
- **HTTP Method**: `GET`
- **Path**: `/api/channels/:channelId/members`
- **Authentication**: Required (JWT. User must be a member)

---

### 10. List DM Conversations
Retrieves all active direct messaging rooms the user belongs to.
- **HTTP Method**: `GET`
- **Path**: `/api/conversations`
- **Authentication**: Required (JWT)

---

### 11. Start or Get DM Conversation
Retrieves or creates a 1-to-1 conversation room with another user.
- **HTTP Method**: `POST`
- **Path**: `/api/conversations`
- **Authentication**: Required (JWT)
- **Request Body**:
  - `otherUserId` (string, required)

---

### 12. Get DM Candidates List
Retrieves other project members the user can start DMs with.
- **HTTP Method**: `GET`
- **Path**: `/api/conversations/candidates`
- **Authentication**: Required (JWT)

---

### 13. Send Message (Channel / DM)
Sends a message to a channel or DM conversation, supporting uploads and mentions.
- **HTTP Method**: `POST`
- **Path**: `/api/channels/:channelId/messages` OR `/api/conversations/:conversationId/messages`
- **Authentication**: Required (JWT. User must be a member)
- **Headers**:
  - `Content-Type: multipart/form-data`
- **Payload**:
  - `content` (string, required)
  - `mentionedUserIds` (string or string[], optional): JSON array string of mentioned user IDs.
  - `attachments` (File array, optional): Up to 10 files (max 10MB per file).

---

### 14. Get Messages (Channel / DM)
Retrieves message history. Supports cursor-based pagination.
- **HTTP Method**: `GET`
- **Path**: `/api/channels/:channelId/messages` OR `/api/conversations/:conversationId/messages`
- **Authentication**: Required (JWT. User must be a member)
- **Query Parameters**:
  - `limit` (number, optional, default: 50)
  - `cursor` (string, optional)

---

### 15. Mark Channel / DM as Read
Updates the user's last read timestamp for the channel or DM room.
- **HTTP Method**: `POST`
- **Path**: `/api/channels/:channelId/read` OR `/api/conversations/:conversationId/read`
- **Authentication**: Required (JWT. User must be a member)

---

## 12. Project Files Endpoints

### 1. Upload Project Files
Uploads up to 10 general project documents (PDF, Word, Excel, PowerPoint, ZIP, images).
- **HTTP Method**: `POST`
- **Path**: `/api/projects/:projectId/files`
- **Authentication**: Required (JWT. User must be project Admin, Manager, or Member)
- **Headers**:
  - `Content-Type: multipart/form-data`
- **Payload**:
  - `files` (File array, required): Max 20MB per file.

---

### 2. List Project Files
Retrieves all files attached to a project workspace.
- **HTTP Method**: `GET`
- **Path**: `/api/projects/:projectId/files`
- **Authentication**: Required (JWT. User must be a member)

---

### 3. Delete Project File
Removes file from project list and deletes the physical file.
- **HTTP Method**: `DELETE`
- **Path**: `/api/projects/:projectId/files/:fileId`
- **Authentication**: Required (JWT. Only file uploader or project Admin/Manager)

---

## 13. Search Endpoints

### 1. Unified Search
Executes a relational `ILIKE` search across projects, tasks, comments, files, and chat messages based on permissions.
- **HTTP Method**: `GET`
- **Path**: `/api/search`
- **Authentication**: Required (JWT)
- **Query Parameters**:
  - `q` (string, required): Search query.
  - `scope` (string, optional): Filter scope (`projects`, `tasks`, `comments`, `files`, `messages`).

---

## 14. Health Check Endpoint

### 1. Application Health Check
Public indicator reporting database and Redis statuses. Used by container managers and monitoring tools.
- **HTTP Method**: `GET`
- **Path**: `/health` (Excludes `/api` prefix)
- **Authentication**: None

#### Example Response (`200 OK - Healthy`)
```json
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up"
    },
    "redis": {
      "status": "up"
    }
  },
  "error": {},
  "details": {
    "database": {
      "status": "up"
    },
    "redis": {
      "status": "up"
    }
  }
}
```

#### Example Response (`503 Service Unavailable - Down`)
```json
{
  "status": "error",
  "info": {},
  "error": {
    "database": {
      "status": "down",
      "message": "Can't reach PostgreSQL server at postgres:5432"
    }
  },
  "details": {
    "database": {
      "status": "down",
      "message": "Can't reach PostgreSQL server at postgres:5432"
    }
  }
}
```
