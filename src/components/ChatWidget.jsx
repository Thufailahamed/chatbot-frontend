import React, { useState, useEffect, useRef } from "react";
import "./ChatWidget.css";

const BACKEND_URL = "chatbot-backend-production-88fa.up.railway.app";

function ChatWidget() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [examplePrompts, setExamplePrompts] = useState([
    "What services does your company offer?",
    "How can I contact support?",
    "Tell me more about your pricing.",
    "What are your business hours?",
  ]);
  const [showExamples, setShowExamples] = useState(true);
  const [listening, setListening] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [useDocument, setUseDocument] = useState(false);
  const [pdfIndices, setPdfIndices] = useState([]);
  const [selectedPdfIndex, setSelectedPdfIndex] = useState("");
  const recognitionRef = useRef(null);

  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/list-indices`);
        const data = await res.json();
        console.log("Fetched indices:", data.indices);
        setPdfIndices(data.indices || []);
      } catch (error) {
        console.error("Error fetching indices:", error);
        setPdfIndices([]);
      }
    };

    fetchIndices();
  }, []);

  useEffect(() => {
    if (
      !("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
    ) {
      alert("Speech Recognition API not supported in this browser.");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setListening(false);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
  }, []);

  const toggleListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      recognition.start();
      setListening(true);
    }
  };

  const sendMessage = async (prompt) => {
    const messageToSend = prompt || input;
    if (!messageToSend.trim()) return;

    const userMsg = { sender: "user", text: messageToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setShowExamples(false);

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ sender: "user", text: messageToSend }],
          use_document: useDocument,
          index_name: selectedPdfIndex,
        }),
      });

      const data = await res.json();

      const botMsg = { sender: "bot", text: data.response };
      setMessages((prev) => [...prev, botMsg]);

      if (
        data.suggestions &&
        Array.isArray(data.suggestions) &&
        data.suggestions.length > 0
      ) {
        setExamplePrompts(data.suggestions);
        setShowExamples(true);
      } else {
        setShowExamples(false);
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "⚠️ Error fetching response from server." },
      ]);
    }
  };

  const endChat = () => {
    setMessages([]);
    setInput("");
    setUseDocument(false);
    setSelectedPdfIndex("");
    setExamplePrompts([
      "What services does your company offer?",
      "How can I contact support?",
      "Tell me more about your pricing.",
      "What are your business hours?",
    ]);
    setShowExamples(true);
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") {
      alert("Please upload a valid PDF file.");
      return;
    }

    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${BACKEND_URL}/upload-pdf`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        alert("PDF uploaded and indexed successfully!");

        const listRes = await fetch(`${BACKEND_URL}/list-indices`);
        const listData = await listRes.json();
        setPdfIndices(listData.indices);

        const fileNameNoExt = file.name
          .replace(".pdf", "")
          .toLowerCase()
          .replace(/\s+/g, "_");
        setSelectedPdfIndex(fileNameNoExt);
      } else {
        const data = await res.json();
        alert("Failed to upload PDF: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading PDF.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="chat-widget">
      <button
        className="toggle-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle chat"
      >
        💬
      </button>

      {isOpen && (
        <div className="chat-popup">
          <div className="chat-header">
            <span>LLaMA 3.2 Assistant</span>
            <button className="close-btn" onClick={() => setIsOpen(false)}>
              ✖
            </button>
          </div>

          <div className="chat-box">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.sender}`}>
                <div className="bubble">
                  <strong>{msg.sender === "user" ? "You" : "Bot"}:</strong>{" "}
                  {msg.text}
                </div>
              </div>
            ))}

            {showExamples && examplePrompts.length > 0 && (
              <div className="example-prompts">
                {examplePrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    className="example-btn"
                    onClick={() => sendMessage(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="file-upload">
            <input
              type="file"
              accept="application/pdf"
              onChange={handlePdfUpload}
              disabled={isUploading}
            />
            <button disabled={isUploading}>
              {isUploading ? "Uploading..." : "Upload PDF"}
            </button>
          </div>

          {pdfIndices && pdfIndices.length > 0 && (
            <div className="index-select">
              <label htmlFor="pdf-index">Select Document:</label>
              <select
                id="pdf-index"
                value={selectedPdfIndex}
                onChange={(e) => setSelectedPdfIndex(e.target.value)}
              >
                {pdfIndices.map((name, idx) => (
                  <option key={idx} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="input-area">
            <input
              type="text"
              placeholder="Type your question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              aria-label="Chat input"
            />
            <button
              className={`mic-btn ${listening ? "listening" : ""}`}
              onClick={toggleListening}
              aria-label={listening ? "Stop voice input" : "Start voice input"}
            >
              🎤
            </button>
            <button
              className="send-btn"
              onClick={() => sendMessage()}
              aria-label="Send message"
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>

          <div className="doc-mode-toggle">
            <button
              className={`doc-btn ${useDocument ? "active" : ""}`}
              onClick={() => setUseDocument(!useDocument)}
              disabled={!selectedPdfIndex}
            >
              {useDocument
                ? `Answering from "${selectedPdfIndex}"`
                : "Answer from PDF"}
            </button>
          </div>

          {messages.length > 0 && (
            <button className="end-chat-btn" onClick={endChat}>
              End Chat
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ChatWidget;
