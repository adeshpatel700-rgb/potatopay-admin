# Batch Payout Architecture

- BullMQ / Redis backed job queues
- Concurrency controls and rate limiter per bank endpoint
- Automatic dead-letter queue routing on repeated network drops
