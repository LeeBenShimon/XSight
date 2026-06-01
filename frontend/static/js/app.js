(function () {
    "use strict";

    const questionInput = document.getElementById("questionInput");
    const askButton = document.getElementById("askButton");
    const loading = document.getElementById("loading");
    const errorPanel = document.getElementById("error");
    const responsePanel = document.getElementById("responsePanel");
    const answerEl = document.getElementById("answer");
    const engineBadge = document.getElementById("engineBadge");
    const citationsWrap = document.getElementById("citationsWrap");
    const citationsEl = document.getElementById("citations");
    const sampleChips = document.getElementById("sampleChips");

    function show(el) { el.classList.remove("hidden"); }
    function hide(el) { el.classList.add("hidden"); }

    function setLoading(isLoading) {
        askButton.disabled = isLoading;
        if (isLoading) {
            show(loading);
            hide(errorPanel);
            hide(responsePanel);
        } else {
            hide(loading);
        }
    }

    function showError(message) {
        errorPanel.textContent = message;
        show(errorPanel);
        hide(responsePanel);
    }

    function renderEngineBadge(engine) {
        engineBadge.className = "badge"; // reset
        if (engine === "analytics") {
            engineBadge.textContent = "computed";
            engineBadge.classList.add("badge--analytics");
            show(engineBadge);
        } else if (engine === "bedrock") {
            engineBadge.textContent = "knowledge base";
            engineBadge.classList.add("badge--bedrock");
            show(engineBadge);
        } else {
            hide(engineBadge);
        }
    }

    function renderCitations(citations) {
        citationsEl.innerHTML = "";
        if (!citations || citations.length === 0) {
            hide(citationsWrap);
            return;
        }
        citations.forEach(function (c) {
            const li = document.createElement("li");
            li.className = "citation";
            const src = document.createElement("span");
            src.className = "citation__source";
            src.textContent = c.source || "knowledge base";
            const text = document.createElement("span");
            text.textContent = c.text || "";
            li.appendChild(src);
            li.appendChild(text);
            citationsEl.appendChild(li);
        });
        show(citationsWrap);
    }

    function renderAnswer(result) {
        answerEl.textContent = result.answer || "(No answer returned.)";
        renderEngineBadge(result.source_engine);
        renderCitations(result.citations);
        show(responsePanel);
    }

    async function sendQuestion() {
        const question = (questionInput.value || "").trim();
        if (!question) {
            showError("Please enter a question.");
            return;
        }
        setLoading(true);
        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: question }),
            });
            let data;
            try {
                data = await response.json();
            } catch (e) {
                throw new Error("The server returned an invalid response.");
            }
            if (!response.ok) {
                throw new Error(data.error || "Request failed (" + response.status + ").");
            }
            renderAnswer(data);
        } catch (err) {
            showError(err.message || "A network error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    askButton.addEventListener("click", sendQuestion);
    questionInput.addEventListener("keydown", function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            sendQuestion();
        }
    });
    sampleChips.addEventListener("click", function (e) {
        if (e.target.classList.contains("chip")) {
            questionInput.value = e.target.textContent;
            sendQuestion();
        }
    });
})();