# Chat Message with Mention Sequence Diagram

This sequence diagram illustrates the flow when a user sends a chat message that contains a user mention (e.g. `@username`). It highlights the interaction between the React frontend, the NestJS REST API, PostgreSQL database, Socket.IO gateway, Redis caching/presence layer, and the asynchronous BullMQ email worker.

## Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor UserA as Browser A (Sender)
    actor UserB as Browser B (Recipient)
    participant API as NestJS REST API
    database DB as PostgreSQL DB
    participant Gateway as Socket.IO Gateway
    participant Redis as Redis Server
    participant Queue as BullMQ (Email Queue)
    participant Worker as BullMQ Worker (Email Processor)

    UserA->>API: POST /api/chat/messages (Payload: content, channelId/conversationId)
    activate API
    API->>DB: Save Message & MessageAttachment records
    activate DB
    DB-->>API: Message record created
    deactivate DB

    API->>DB: Parse mentions in text & create MessageMention records
    activate DB
    DB-->>API: MessageMention records created
    deactivate DB

    API->>DB: Upsert ChannelLastRead/ConversationParticipant lastReadAt for Sender
    activate DB
    DB-->>API: Read timestamps updated
    deactivate DB

    API->>Gateway: Broadcast message:new to Socket room
    activate Gateway
    Gateway-->>UserA: Emit message:new (updates local UI list)
    Gateway-->>UserB: Emit message:new (updates local UI list)
    deactivate Gateway

    API->>Gateway: Broadcast channel:message_received / conversation:message_received
    activate Gateway
    Gateway-->>UserB: Emit event (invalidates React Query caches for unread badge counters)
    deactivate Gateway

    alt Recipient is mentioned (User B)
        API->>DB: Create Notification record (Type: MENTIONED_IN_CHAT)
        activate DB
        DB-->>API: Notification record created
        deactivate DB

        API->>Gateway: Emit notification:new to recipient's personal room ("user:userId")
        activate Gateway
        Gateway-->>UserB: Emit notification:new (displays in-app toast / update inbox counter)
        deactivate Gateway

        API->>DB: Check recipient's notifyByEmail preference
        activate DB
        DB-->>API: Returns notifyByEmail status (e.g., true)
        deactivate DB

        opt notifyByEmail is true
            API->>Queue: Enqueue "email" job (Template: "notification")
            activate Queue
            Queue->>Redis: Persist job metadata in BullMQ list
            Redis-->>Queue: Acknowledge job stored
            Queue-->>API: Job enqueued successfully
            deactivate Queue
        end
    end

    API-->>UserA: Return 201 Created (Message payload)
    deactivate API

    %% Asynchronous Processing (BullMQ Worker)
    note over Worker, Redis: Asynchronous BullMQ Worker polling Redis
    Worker->>Redis: Poll & lock next available "email" job
    activate Worker
    activate Redis
    Redis-->>Worker: Return job details (recipient's email, name, message snippet)
    deactivate Redis

    Worker->>Worker: Send email via SMTP (Nodemailer using Gmail SMTP)
    Worker->>Redis: Mark job as completed
    activate Redis
    Redis-->>Worker: Acknowledge job removed/stored in completed log
    deactivate Redis
    deactivate Worker
```

## Architectural Highlights of this Flow

1. **Hybrid REST & WebSockets**: The REST API handles the persistence, business logic validations, and relational mapping (mentions, attachments, database writes) to ensure consistency. Socket.IO is used strictly for instantaneous event broadcasting.
2. **Decoupled Real-time Updates**: Real-time chat list updates (`message:new`) are broadcast to channel-specific rooms, while unread notifications (`channel:message_received` / `conversation:message_received`) are broadcast to target users to trigger optimistic local cache invalidation on the client.
3. **Resilient Background Processing**: Heavy operations like SMTP connections and email delivery are offloaded to **BullMQ** using Redis as a job broker. If the SMTP server is temporarily unreachable, BullMQ will apply exponential backoff (retrying 3 times) without blocking the user's chat interface.
