import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useNavigate, useViewTransitionState } from "react-router-dom";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { Play } from "lucide-react";
import Timer from "./Timer";
import MuteButton from './MuteButton';

import { useCode } from "../context/useCode.jsx";
import { useHighlighted } from "../context/useHighlighted.jsx";


function CodeEditor({ hasStarted, averageVolume, startRecording, stopRecording, status, endTranscription }) {
  const {code, setCode} = useCode();
  const [output, setOutput] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [fontSize, setFontSize] = useState(14);
  const [language, setLanguage] = useState("cpp"); 
  const {highlighted, setHighlighted} = useHighlighted("");

  const [isDoneClicked, setIsDoneClicked] = useState(false); 

  const statusRef = useRef(status);

  const navigate = useNavigate();

  const handleCodeChange = (value) => {
    setCode(value);
  };

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const handleDoneInterview = async () => {
    if (isDoneClicked) return;
    setIsDoneClicked(true);

    const waitForStatus = async () => {
      return new Promise((resolve) => {
        const interval = setInterval(() => {
          console.log(statusRef.current);
          if (statusRef.current == "Ready to record") {
            clearInterval(interval);
            resolve();
          }
        }, 500);
      });
    };

    try {
      await waitForStatus();

      const response = await axios.post(`/api/end`, {}, {
        responseType: 'blob', // 👈 important: expecting audio
        withCredentials: true
      });

      const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
  
      // Wait for audio to finish before navigating
      audio.onended = () => {
        navigate("/demo");
      };
    } catch (error) {
      console.error("Error ending interview:", error);
      navigate("/"); // fallback navigate
    }
  };

  const getLanguageExtension = () => {
    switch (language) {
      case "javascript": return javascript();
      case "python": return python();
      case "cpp": return cpp();
      case "java": return java();
      default: return javascript();
    }
  };

  const getPistonLanguage = () => {
    switch (language) {
      case "javascript": return "javascript";
      case "python": return "python3";
      case "cpp": return "cpp";
      case "java": return "java";
      default: return "javascript";
    }
  };

  const compileCode = async () => {
    setOutput("Running...");
    try {
      console.log(code);
      console.log(getPistonLanguage());
      
      const response = await axios.post("https://emkc.org/api/v2/piston/execute", {
        language: getPistonLanguage(),
        version: "*",
        files: [{ content: code }],
        stdin: "",
      });
      setOutput(response.data.run.stdout || response.data.run.stderr);
    } catch (error) {
      console.error("Compilation Error:", error);
      setOutput("Error compiling code. Please check API or code format.");
    }
  };

  return (
    <div id="code-editor" className="w-full p-6 pl-7 h-screen flex flex-col bg-(--background) text-white">

      <div className="flex justify-between items-center border-b border-(--code-stroke) pb-3">
        <div className="flex items-center">
          <h1 className="text-lg font-semibold">Code Editor</h1>
          
          <div className="ml-3 flex items-center space-x-3">
            <Timer hasStarted={hasStarted} handleDoneInterview={handleDoneInterview} />
            <button
              className={`bg-(--red) cursor-pointer transition-all px-3 py-1 text-xs font-semibold rounded-full text-white ${
                isDoneClicked ? "opacity-50 cursor-not-allowed" : ""
              }`}
              onClick={handleDoneInterview}
              disabled={isDoneClicked}
            >
              DONE INTERVIEW
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex mr-1">
            <button
              onClick={() => setFontSize((prev) => Math.max(prev - 2, 12))}
              className="cursor-pointer w-6 h-6 flex items-center justify-center rounded-full hover:bg-(--code-stroke)/20 text-white text-lg font-bold"
              title="Decrease Font Size"
            >
              −
            </button>
            <button
              onClick={() => setFontSize((prev) => Math.min(prev + 2, 20))}
              className="cursor-pointer w-6 h-6 flex items-center justify-center rounded-full hover:bg-(--code-stroke)/20 text-white text-lg font-bold"
              title="Increase Font Size"
            >
              +
            </button>
          </div>

          <div className="border border-(--code-stroke) pr-2 pl-1 py-1 rounded-sm">
            <select
              className="bg-transparent text-sm outline-none cursor-pointer px-1 pr-2"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="cpp">C++</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="javascript">JavaScript</option>
            </select>
          </div>
        </div>
      </div>


      <div className="mt-3 relative flex-1 border border-(--code-stroke) rounded-sm overflow-hidden" style={{ "scrollbarColor": "var(--code-stroke) var(--background)" }}>
        <CodeMirror
          value={code}
          className="w-full h-full"
          height="100%"
          theme={vscodeDark}
          extensions={[getLanguageExtension(), basicSetup, EditorView.lineWrapping]}
          onChange={handleCodeChange}
          style={{ fontSize: `${fontSize}px` }}
          onUpdate={(viewUpdate) => {
            const { state } = viewUpdate.view;
            const selection = state.selection.main;

            const fromLine = state.doc.lineAt(selection.from);
            const toLine = state.doc.lineAt(selection.to);

            let selectedLines = [];

            for (let lineNumber = fromLine.number; lineNumber <= toLine.number; lineNumber++) {
              const line = state.doc.line(lineNumber);

              const lineStart = line.from;
              const lineEnd = line.to;

              const selectionStart = Math.max(selection.from, lineStart);
              const selectionEnd = Math.min(selection.to, lineEnd);

              const before = state.sliceDoc(lineStart, selectionStart);
              const selected = state.sliceDoc(selectionStart, selectionEnd);
              const after = state.sliceDoc(selectionEnd, lineEnd);

              if (selected.trim().length > 0) {
                selectedLines.push(`${line.number}: ${before}<highlighted>${selected}</highlighted>${after}`);
              }
            }

            const finalHighlight = selectedLines.join("\n");
            setHighlighted(finalHighlight);
            setSelectedText(finalHighlight);
          }}
        />

        <button
          id="run-button"
          onClick={compileCode}
          className="hover:scale-105 transition-all absolute bottom-4 right-4 w-9 h-9 flex items-center justify-center bg-(--hero) rounded-full hover:bg-(--hero) hover:opacity-90 shadow-md cursor-pointer"
        >
          <Play size={18} />
        </button>
      </div>

      <div className="mt-4 bg-(--code-fill) p-3 rounded-sm border border-(--code-stroke) max-h-40 overflow-y-auto">
        <h3 className="text-[14px] font-bold text-(--code-text)">Output:</h3>
        <pre className="text-[14px] text-(--code-text) font-thin whitespace-pre-wrap">{output}</pre>
      </div>

      <MuteButton status={status} hasStarted={hasStarted} averageVolume={averageVolume} startRecording={startRecording} stopRecording={stopRecording} />
    </div>
  );
}

export default CodeEditor;
