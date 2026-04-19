# Security Specification: Alesta Wellness Dashboard

## Data Invariants
1. A Client must have a name, phone, searchName, and ownerId.
2. A Treatment must belong to a Client and have a date, treatmentName, and createdAt.
3. Only the `ownerId` of a Client can read/write that client and their sub-treatments.
4. `createdAt` is immutable.
5. All IDs must be valid alphanumeric strings.

## The Dirty Dozen Payloads (Rejection Targets)
1. **Id Poisoning**: Attempt to create a client with a 2KB junk character ID.
2. **Identity Spoofing**: User A attempts to create a client with User B's `ownerId`.
3. **Ghost Fields**: Attempt to add `isAdmin: true` to a client document.
4. **State Shortcutting**: Attempt to update `createdAt` on an existing client.
5. **Orphaned Writes**: Attempt to create a treatment for a client ID that doesn't exist.
6. **PII Leak**: Unauthenticated user attempts to list clients.
7. **Cross-User Access**: User B attempts to read User A's client by direct ID.
8. **Missing Schema**: Attempt to create a client without a `phone` number.
9. **Invalid Types**: Attempt to set `name` to a boolean value.
10. **Size Exhaustion**: Attempt to send a 1MB string in the `address` field.
11. **Future Dating**: Attempt to set `createdAt` to a future timestamp (not using server time).
12. **Query Scraping**: Authenticated user attempts to list all clients without filtering by their own `ownerId`.
