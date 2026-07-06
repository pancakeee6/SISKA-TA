import asyncio
from typing import List

class SSEManager:
    """Manages SSE connections for realtime attendance updates."""

    def __init__(self):
        self.active_queues: List[asyncio.Queue] = []

    def connect(self) -> asyncio.Queue:
        """Create a new queue for a connecting client."""
        queue = asyncio.Queue()
        self.active_queues.append(queue)
        return queue

    def disconnect(self, queue: asyncio.Queue):
        """Remove a client's queue."""
        if queue in self.active_queues:
            self.active_queues.remove(queue)

    async def broadcast(self, message: dict):
        """Broadcast message to all connected admin clients."""
        for queue in self.active_queues:
            await queue.put(message)

# Singleton instance
sse_manager = SSEManager()
