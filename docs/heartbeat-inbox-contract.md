# Heartbeat inbox contract

The heartbeat runtime owns the canonical proactive-message timeline. Phone delivery is a view-state concern, not a memory boundary.

## Continuity rule

Every generated assistant message must be appended to the server-side canonical timeline before the next wake-up is generated. A message remains part of that timeline even while it is still pending delivery to Polaris. Therefore, if four messages are waiting in the inbox, message 2 can see message 1, message 3 can see messages 1-2, and message 4 can see messages 1-3.

Acknowledgement only changes delivery state. It must never remove a message from the generation timeline.

## HTTP API

The configured endpoint is the shared prefix, for example:

`https://heartbeat.example.com/api/polaris/heartbeat`

All requests use `Authorization: Bearer <inbox-token>`.

### Read pending messages

`GET <endpoint>/inbox`

Response:

```json
{
  "events": [
    {
      "id": "stable-server-event-id",
      "content": "assistant message text",
      "createdAt": 1786440000000
    }
  ]
}
```

Events must be returned oldest first. `createdAt` is Unix time in milliseconds.

### Acknowledge locally persisted messages

`POST <endpoint>/ack`

```json
{
  "ids": ["stable-server-event-id"]
}
```

Acknowledgement is idempotent. Polaris sends it only after the messages have been persisted locally. If the acknowledgement is lost, the same stable event id lets Polaris deduplicate the next delivery safely.

## CORS and security

- Serve the API over HTTPS.
- Allow the deployed Polaris PWA origin.
- Allow `GET`, `POST`, and `OPTIONS`.
- Allow the `Authorization` and `Content-Type` headers.
- Do not put the token in a query string or commit it to source control.
