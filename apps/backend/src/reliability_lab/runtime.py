"""Entry point for the self-contained desktop sidecar, independent of the checkout.

The native host supplies a random session token, an ephemeral loopback port, and
the per-user data directory. Closing the parent's input pipe stops Uvicorn even
when the parent crashes, avoiding an orphaned local service.
"""

import os
import sys
import threading

import uvicorn


def main():
    if "--version" in sys.argv:
        print("agent-reliability-backend 0.1.0")
        return
    if len(os.environ.get("LAB_SESSION_TOKEN", "")) < 32:
        raise SystemExit("A native session token is required to start the bundled backend.")
    port = int(os.environ["LAB_PORT"])
    if not 1 <= port <= 65535:
        raise SystemExit("Invalid local service port.")
    from reliability_lab.main import app

    server = uvicorn.Server(
        uvicorn.Config(
            app,
            host="127.0.0.1",
            port=port,
            access_log=False,
            loop="asyncio",
            http="h11",
            lifespan="on",
            timeout_graceful_shutdown=2,
        )
    )
    if os.environ.get("LAB_PARENT_MANAGED") == "1":

        def watch_parent():
            try:
                if sys.stdin is not None:
                    sys.stdin.buffer.read()
            finally:
                from reliability_lab.evaluation_service import shutdown_requested

                shutdown_requested.set()
                server.should_exit = True

        threading.Thread(target=watch_parent, name="parent-lifetime", daemon=True).start()
    server.run()


if __name__ == "__main__":
    main()
