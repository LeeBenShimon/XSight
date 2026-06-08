import os
import logging

from flask import Flask, send_from_directory
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

from backend.routes.chat_routes import chat_bp  # noqa: E402
from backend.routes.upload_routes import upload_bp  # noqa: E402


def create_app() -> Flask:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    dist = os.path.join(os.path.dirname(__file__), "frontend-react", "dist")

    app = Flask(__name__, static_folder=dist, static_url_path="")

    app.register_blueprint(chat_bp)
    app.register_blueprint(upload_bp)

    @app.route("/")
    def index():
        return send_from_directory(app.static_folder, "index.html")

    # SPA fallback — let React Router handle unknown paths
    @app.errorhandler(404)
    def not_found(_e):
        # Return index.html for unknown routes so the SPA can render them;
        # API 404s are handled before they reach this handler.
        if _e.description and "/api/" in str(_e.description):
            return {"error": "Resource not found."}, 404
        return send_from_directory(app.static_folder, "index.html")

    @app.errorhandler(405)
    def method_not_allowed(_e):
        return {"error": "Method not allowed."}, 405

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
