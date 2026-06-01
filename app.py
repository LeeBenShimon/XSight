import os
import logging

from flask import Flask, render_template
from dotenv import load_dotenv

load_dotenv()  # read .env before importing anything that needs env vars

from backend.routes.chat_routes import chat_bp  # noqa: E402


def create_app() -> Flask:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    app = Flask(
        __name__,
        template_folder=os.path.join("frontend", "templates"),
        static_folder=os.path.join("frontend", "static"),
    )

    app.register_blueprint(chat_bp)

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.errorhandler(404)
    def not_found(_e):
        return {"error": "Resource not found."}, 404

    @app.errorhandler(405)
    def method_not_allowed(_e):
        return {"error": "Method not allowed."}, 405

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)