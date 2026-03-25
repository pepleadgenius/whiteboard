import { useState, useRef, useEffect, useCallback } from "react";

const TOOLS = [
  { id: "pencil", label: "Pencil", icon: "✏️" },
  { id: "text", label: "Text", icon: "T" },
  { id: "paint", label: "Fill", icon: "🪣" },
  { id: "eraser", label: "Eraser", icon: "⬜" },
];

const BRUSH_SIZES = [2, 5, 10, 20, 40];

export default function Whiteboard() {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState("pencil");
  const [darkMode, setDarkMode] = useState(false);
  const [brushSize, setBrushSize] = useState(5);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [textInput, setTextInput] = useState({ visible: false, x: 0, y: 0, value: "" });
  const [color, setColor] = useState("#1f2937");
  const lastPos = useRef(null);
  const inputRef = useRef(null);

  const COLORS = darkMode
    ? ["#ffffff", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"]
    : ["#1f2937", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#2563eb", "#7c3aed", "#db2777", "#6b7280"];

  const bgColor = darkMode ? "#0f172a" : "#f8fafc";
  const uiBg = darkMode ? "#1e293b" : "#ffffff";
  const uiBorder = darkMode ? "#334155" : "#e2e8f0";
  const textColor = darkMode ? "#e2e8f0" : "#1f2937";
  const accentColor = darkMode ? "#60a5fa" : "#2563eb";

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveHistory();
  }, [bgColor]);

  useEffect(() => {
    if (textInput.visible && inputRef.current) inputRef.current.focus();
  }, [textInput.visible]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history, redoStack]);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const saveHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imageData = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    setHistory((h) => [...h.slice(-29), imageData]);
    setRedoStack([]);
  }, []);

  const undo = () => {
    if (history.length < 2) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const newHistory = [...history];
    const current = newHistory.pop();
    setRedoStack((r) => [...r, current]);
    setHistory(newHistory);
    ctx.putImageData(newHistory[newHistory.length - 1], 0, 0);
  };

  const redo = () => {
    if (!redoStack.length) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const newRedo = [...redoStack];
    const next = newRedo.pop();
    setRedoStack(newRedo);
    setHistory((h) => [...h, next]);
    ctx.putImageData(next, 0, 0);
  };

  const clearCanvas = () => {
    if (window.confirm("Clear entire canvas? This cannot be undone.")) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      saveHistory();
    }
  };

  const floodFill = (ctx, x, y, fillColor) => {
    const canvas = canvasRef.current;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const w = canvas.width;
    const h = canvas.height;

    const px = (Math.round(x) + Math.round(y) * w) * 4;
    const targetR = data[px], targetG = data[px + 1], targetB = data[px + 2], targetA = data[px + 3];

    const hex = fillColor.replace("#", "");
    const fillR = parseInt(hex.substring(0, 2), 16);
    const fillG = parseInt(hex.substring(2, 4), 16);
    const fillB = parseInt(hex.substring(4, 6), 16);

    if (targetR === fillR && targetG === fillG && targetB === fillB) return;

    const stack = [Math.round(x) + Math.round(y) * w];
    const visited = new Uint8Array(w * h);

    const match = (i) =>
      Math.abs(data[i * 4] - targetR) < 30 &&
      Math.abs(data[i * 4 + 1] - targetG) < 30 &&
      Math.abs(data[i * 4 + 2] - targetB) < 30 &&
      Math.abs(data[i * 4 + 3] - targetA) < 30;

    while (stack.length) {
      const idx = stack.pop();
      if (idx < 0 || idx >= w * h || visited[idx] || !match(idx)) continue;
      visited[idx] = 1;
      data[idx * 4] = fillR;
      data[idx * 4 + 1] = fillG;
      data[idx * 4 + 2] = fillB;
      data[idx * 4 + 3] = 255;
      stack.push(idx + 1, idx - 1, idx + w, idx - w);
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const startDraw = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);

    if (tool === "text") {
      setTextInput({ visible: true, x: pos.x, y: pos.y, value: "" });
      return;
    }

    if (tool === "paint") {
      floodFill(ctx, pos.x, pos.y, color);
      saveHistory();
      return;
    }

    setIsDrawing(true);
    lastPos.current = pos;

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, (tool === "eraser" ? brushSize * 2 : brushSize) / 2, 0, Math.PI * 2);
    ctx.fillStyle = tool === "eraser" ? bgColor : color;
    ctx.fill();
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === "eraser" ? bgColor : color;
    ctx.lineWidth = tool === "eraser" ? brushSize * 2 : brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    lastPos.current = pos;
  };

  const stopDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveHistory();
  };

  const commitText = () => {
    if (!textInput.value.trim()) {
      setTextInput({ visible: false, x: 0, y: 0, value: "" });
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.font = `600 ${brushSize * 4 + 14}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`;
    ctx.fillStyle = color;
    ctx.fillText(textInput.value, textInput.x, textInput.y);
    setTextInput({ visible: false, x: 0, y: 0, value: "" });
    saveHistory();
  };

  const downloadCanvas = () => {
    const link = document.createElement("a");
    link.download = `whiteboard-${new Date().getTime()}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  const getCursor = () => {
    if (tool === "eraser") return "grab";
    if (tool === "text") return "text";
    if (tool === "paint") return "crosshair";
    return "crosshair";
  };

  return (
    <div
      className="w-screen h-screen overflow-hidden transition-colors duration-300"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {/* Top Navigation */}
      <div
        className="h-16 border-b flex items-center justify-between px-6 transition-all duration-300"
        style={{ borderColor: uiBorder, backgroundColor: uiBg }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-2">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: accentColor }}>
              Canvas
            </h1>
            <span className="text-xs font-medium opacity-50 uppercase tracking-widest">Draw & Annotate</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Stats */}
          <div className="flex items-center gap-6 pr-4 border-r" style={{ borderColor: uiBorder }}>
            <div className="flex items-center gap-2">
              <span className="text-lg" role="img">
                {TOOLS.find((t) => t.id === tool)?.icon}
              </span>
              <span className="text-sm font-medium capitalize">{tool}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm opacity-60">Size:</span>
              <span className="text-sm font-medium">{brushSize}px</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={undo}
              disabled={history.length < 2}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: history.length < 2 ? "transparent" : "rgba(59, 130, 246, 0.1)",
                color: history.length < 2 ? "rgba(0,0,0,0.3)" : accentColor,
                cursor: history.length < 2 ? "not-allowed" : "pointer",
              }}
              title="⌘Z"
            >
              ↩ Undo
            </button>
            <button
              onClick={redo}
              disabled={!redoStack.length}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: !redoStack.length ? "transparent" : "rgba(59, 130, 246, 0.1)",
                color: !redoStack.length ? "rgba(0,0,0,0.3)" : accentColor,
                cursor: !redoStack.length ? "not-allowed" : "pointer",
              }}
              title="⌘Y"
            >
              ↪ Redo
            </button>
            <button
              onClick={downloadCanvas}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: "rgba(34, 197, 94, 0.1)",
                color: darkMode ? "#86efac" : "#16a34a",
              }}
              title="Download"
            >
              ↓ Save
            </button>
            <button
              onClick={clearCanvas}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                color: darkMode ? "#fca5a5" : "#dc2626",
              }}
              title="Clear canvas"
            >
              ✕ Clear
            </button>

            {/* Theme Toggle */}
            <div className="ml-3 pl-3 border-l" style={{ borderColor: uiBorder }}>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="w-10 h-10 rounded-lg flex items-center justify-center transition-all"
                style={{
                  backgroundColor: "rgba(59, 130, 246, 0.1)",
                  color: accentColor,
                }}
                title={darkMode ? "Light mode" : "Dark mode"}
              >
                {darkMode ? "☀️" : "🌙"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex h-[calc(100vh-64px)]">
        {/* Left Toolbar */}
        <div
          className="w-24 border-r flex flex-col gap-4 p-4 overflow-y-auto transition-all duration-300"
          style={{ borderColor: uiBorder, backgroundColor: uiBg }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-3">Tools</p>
            <div className="flex flex-col gap-2">
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id)}
                  className="aspect-square rounded-lg flex flex-col items-center justify-center gap-1 transition-all duration-200 hover:scale-105"
                  style={{
                    backgroundColor: tool === t.id ? accentColor : "transparent",
                    color: tool === t.id ? uiBg : textColor,
                    border: `2px solid ${tool === t.id ? accentColor : uiBorder}`,
                    opacity: tool === t.id ? 1 : 0.6,
                  }}
                  title={t.label}
                >
                  <span className="text-lg">{t.icon}</span>
                  <span className="text-[9px] font-medium uppercase tracking-wider leading-none">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t pt-4" style={{ borderColor: uiBorder }}>
            <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-3">Size</p>
            <div className="flex flex-col gap-2">
              {BRUSH_SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setBrushSize(s)}
                  className="h-10 rounded-lg flex items-center justify-center transition-all border-2"
                  style={{
                    borderColor: brushSize === s ? accentColor : uiBorder,
                    backgroundColor: brushSize === s ? "rgba(59, 130, 246, 0.1)" : "transparent",
                  }}
                >
                  <div
                    className="rounded-full transition-all"
                    style={{
                      width: Math.min(s * 1.5, 24),
                      height: Math.min(s * 1.5, 24),
                      backgroundColor: accentColor,
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="border-t pt-4" style={{ borderColor: uiBorder }}>
            <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-3">Colors</p>
            <div className="flex flex-col gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-10 h-10 rounded-lg transition-all border-2 hover:scale-105"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? accentColor : uiBorder,
                    borderWidth: color === c ? "3px" : "2px",
                  }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
          <div
            className="relative rounded-2xl shadow-2xl overflow-hidden"
            style={{ cursor: getCursor() }}
          >
            <canvas
              ref={canvasRef}
              width={1400}
              height={800}
              className="block border-4"
              style={{ borderColor: uiBorder }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />

            {/* Text Input Overlay */}
            {textInput.visible && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${(textInput.x / 1400) * 100}%`,
                  top: `${(textInput.y / 800) * 100}%`,
                  transform: "translateY(-100%)",
                  pointerEvents: "auto",
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={textInput.value}
                  onChange={(e) => setTextInput((t) => ({ ...t, value: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitText();
                    if (e.key === "Escape") setTextInput({ visible: false, x: 0, y: 0, value: "" });
                  }}
                  onBlur={commitText}
                  placeholder="Type text…"
                  className="outline-none px-3 py-1 rounded-lg shadow-lg border-2 font-medium"
                  style={{
                    fontSize: Math.max(brushSize * 4 + 14, 16) + "px",
                    borderColor: accentColor,
                    backgroundColor: uiBg,
                    color: textColor,
                    minWidth: "120px",
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Hint Bar */}
      <div
        className="hidden lg:flex items-center justify-center gap-4 py-3 border-t text-xs font-medium opacity-50 uppercase tracking-widest"
        style={{ borderColor: uiBorder, backgroundColor: uiBg }}
      >
        <span>✏️ Draw</span>
        <span>·</span>
        <span>T Add Text</span>
        <span>·</span>
        <span>🪣 Fill Color</span>
        <span>·</span>
        <span>⬜ Erase</span>
        <span>·</span>
        <span>⌘Z / ⌘Y Undo/Redo</span>
      </div>
    </div>
  );
}



// import { useState, useRef, useEffect, useCallback } from "react";

// const TOOLS = [
//   { id: "pencil", label: "Pencil", icon: "✏️" },
//   { id: "text", label: "Text", icon: "T" },
//   { id: "paint", label: "Paint", icon: "🪣" },
//   { id: "eraser", label: "Eraser", icon: "⬜" },
// ];

// const COLORS = [
//   "#0f172a", "#ef4444", "#f97316", "#eab308",
//   "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899",
//   "#ffffff", "#64748b",
// ];

// const BRUSH_SIZES = [2, 5, 10, 20, 40];

// export default function App() {
//   const canvasRef = useRef(null);
//   const overlayRef = useRef(null);
//   const [tool, setTool] = useState("pencil");
//   const [color, setColor] = useState("#0f172a");
//   const [brushSize, setBrushSize] = useState(5);
//   const [isDrawing, setIsDrawing] = useState(false);
//   const [history, setHistory] = useState([]);
//   const [redoStack, setRedoStack] = useState([]);
//   const [textInput, setTextInput] = useState({ visible: false, x: 0, y: 0, value: "" });
//   const lastPos = useRef(null);
//   const inputRef = useRef(null);

//   // Initialize canvas
//   useEffect(() => {
//     const canvas = canvasRef.current;
//     const ctx = canvas.getContext("2d");
//     ctx.fillStyle = "#f8fafc";
//     ctx.fillRect(0, 0, canvas.width, canvas.height);
//     saveHistory();
//   }, []);

//   useEffect(() => {
//     if (textInput.visible && inputRef.current) inputRef.current.focus();
//   }, [textInput.visible]);

//   const getPos = (e, canvas) => {
//     const rect = canvas.getBoundingClientRect();
//     const scaleX = canvas.width / rect.width;
//     const scaleY = canvas.height / rect.height;
//     const clientX = e.touches ? e.touches[0].clientX : e.clientX;
//     const clientY = e.touches ? e.touches[0].clientY : e.clientY;
//     return {
//       x: (clientX - rect.left) * scaleX,
//       y: (clientY - rect.top) * scaleY,
//     };
//   };

//   const saveHistory = useCallback(() => {
//     const canvas = canvasRef.current;
//     if (!canvas) return;
//     const imageData = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
//     setHistory((h) => [...h.slice(-29), imageData]);
//     setRedoStack([]);
//   }, []);

//   const undo = () => {
//     if (history.length < 2) return;
//     const canvas = canvasRef.current;
//     const ctx = canvas.getContext("2d");
//     const newHistory = [...history];
//     const current = newHistory.pop();
//     setRedoStack((r) => [...r, current]);
//     setHistory(newHistory);
//     ctx.putImageData(newHistory[newHistory.length - 1], 0, 0);
//   };

//   const redo = () => {
//     if (!redoStack.length) return;
//     const canvas = canvasRef.current;
//     const ctx = canvas.getContext("2d");
//     const newRedo = [...redoStack];
//     const next = newRedo.pop();
//     setRedoStack(newRedo);
//     setHistory((h) => [...h, next]);
//     ctx.putImageData(next, 0, 0);
//   };

//   const clearCanvas = () => {
//     const canvas = canvasRef.current;
//     const ctx = canvas.getContext("2d");
//     ctx.fillStyle = "#f8fafc";
//     ctx.fillRect(0, 0, canvas.width, canvas.height);
//     saveHistory();
//   };

//   const floodFill = (ctx, x, y, fillColor) => {
//     const canvas = canvasRef.current;
//     const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
//     const data = imageData.data;
//     const w = canvas.width;
//     const h = canvas.height;

//     const px = (Math.round(x) + Math.round(y) * w) * 4;
//     const targetR = data[px], targetG = data[px + 1], targetB = data[px + 2], targetA = data[px + 3];

//     const hex = fillColor.replace("#", "");
//     const fillR = parseInt(hex.substring(0, 2), 16);
//     const fillG = parseInt(hex.substring(2, 4), 16);
//     const fillB = parseInt(hex.substring(4, 6), 16);

//     if (targetR === fillR && targetG === fillG && targetB === fillB) return;

//     const stack = [Math.round(x) + Math.round(y) * w];
//     const visited = new Uint8Array(w * h);

//     const match = (i) =>
//       Math.abs(data[i * 4] - targetR) < 30 &&
//       Math.abs(data[i * 4 + 1] - targetG) < 30 &&
//       Math.abs(data[i * 4 + 2] - targetB) < 30 &&
//       Math.abs(data[i * 4 + 3] - targetA) < 30;

//     while (stack.length) {
//       const idx = stack.pop();
//       if (idx < 0 || idx >= w * h || visited[idx] || !match(idx)) continue;
//       visited[idx] = 1;
//       data[idx * 4] = fillR;
//       data[idx * 4 + 1] = fillG;
//       data[idx * 4 + 2] = fillB;
//       data[idx * 4 + 3] = 255;
//       stack.push(idx + 1, idx - 1, idx + w, idx - w);
//     }

//     ctx.putImageData(imageData, 0, 0);
//   };

//   const startDraw = (e) => {
//     e.preventDefault();
//     const canvas = canvasRef.current;
//     const ctx = canvas.getContext("2d");
//     const pos = getPos(e, canvas);

//     if (tool === "text") {
//       setTextInput({ visible: true, x: pos.x, y: pos.y, value: "" });
//       return;
//     }

//     if (tool === "paint") {
//       floodFill(ctx, pos.x, pos.y, color);
//       saveHistory();
//       return;
//     }

//     setIsDrawing(true);
//     lastPos.current = pos;

//     ctx.beginPath();
//     ctx.arc(pos.x, pos.y, (tool === "eraser" ? brushSize * 2 : brushSize) / 2, 0, Math.PI * 2);
//     ctx.fillStyle = tool === "eraser" ? "#f8fafc" : color;
//     ctx.fill();
//   };

//   const draw = (e) => {
//     e.preventDefault();
//     if (!isDrawing) return;
//     const canvas = canvasRef.current;
//     const ctx = canvas.getContext("2d");
//     const pos = getPos(e, canvas);

//     ctx.beginPath();
//     ctx.moveTo(lastPos.current.x, lastPos.current.y);
//     ctx.lineTo(pos.x, pos.y);
//     ctx.strokeStyle = tool === "eraser" ? "#f8fafc" : color;
//     ctx.lineWidth = tool === "eraser" ? brushSize * 2 : brushSize;
//     ctx.lineCap = "round";
//     ctx.lineJoin = "round";
//     ctx.stroke();

//     lastPos.current = pos;
//   };

//   const stopDraw = () => {
//     if (!isDrawing) return;
//     setIsDrawing(false);
//     saveHistory();
//   };

//   const commitText = () => {
//     if (!textInput.value.trim()) {
//       setTextInput({ visible: false, x: 0, y: 0, value: "" });
//       return;
//     }
//     const canvas = canvasRef.current;
//     const ctx = canvas.getContext("2d");
//     ctx.font = `${brushSize * 4 + 12}px 'Georgia', serif`;
//     ctx.fillStyle = color;
//     ctx.fillText(textInput.value, textInput.x, textInput.y);
//     setTextInput({ visible: false, x: 0, y: 0, value: "" });
//     saveHistory();
//   };

//   const downloadCanvas = () => {
//     const link = document.createElement("a");
//     link.download = "annotation.png";
//     link.href = canvasRef.current.toDataURL();
//     link.click();
//   };

//   const getCursor = () => {
//     if (tool === "eraser") return "cell";
//     if (tool === "text") return "text";
//     if (tool === "paint") return "crosshair";
//     return "crosshair";
//   };

//   return (
//     <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-4 font-mono">
//       {/* Header */}
//       <div className="w-full max-w-5xl mb-3 flex items-center justify-between">
//         <div className="flex items-center gap-2">
//           <span className="text-amber-400 text-xl font-bold tracking-tight">ANNO</span>
//           <span className="text-stone-500 text-xs uppercase tracking-widest mt-0.5">/ canvas</span>
//         </div>
//         <div className="flex gap-2">
//           <button
//             onClick={undo}
//             disabled={history.length < 2}
//             className="px-3 py-1.5 text-xs text-stone-400 border border-stone-700 rounded hover:border-stone-400 hover:text-stone-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
//           >
//             ↩ Undo
//           </button>
//           <button
//             onClick={redo}
//             disabled={!redoStack.length}
//             className="px-3 py-1.5 text-xs text-stone-400 border border-stone-700 rounded hover:border-stone-400 hover:text-stone-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
//           >
//             ↪ Redo
//           </button>
//           <button
//             onClick={clearCanvas}
//             className="px-3 py-1.5 text-xs text-red-400 border border-red-900 rounded hover:border-red-500 hover:text-red-300 transition-all"
//           >
//             ✕ Clear
//           </button>
//           <button
//             onClick={downloadCanvas}
//             className="px-3 py-1.5 text-xs text-amber-400 border border-amber-800 rounded hover:border-amber-500 hover:text-amber-300 transition-all"
//           >
//             ↓ Save
//           </button>
//         </div>
//       </div>

//       <div className="w-full max-w-5xl flex gap-3">
//         {/* Sidebar */}
//         <div className="flex flex-col gap-4 w-20 shrink-0">
//           {/* Tools */}
//           <div className="bg-stone-900 border border-stone-800 rounded-xl p-2 flex flex-col gap-1">
//             <p className="text-stone-600 text-[9px] uppercase tracking-widest text-center mb-1">Tools</p>
//             {TOOLS.map((t) => (
//               <button
//                 key={t.id}
//                 onClick={() => setTool(t.id)}
//                 title={t.label}
//                 className={`w-full aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-lg transition-all border ${
//                   tool === t.id
//                     ? "bg-amber-400 border-amber-300 text-stone-900 shadow-lg shadow-amber-900/40"
//                     : "border-transparent text-stone-400 hover:bg-stone-800 hover:text-stone-200"
//                 }`}
//               >
//                 <span className={t.id === "text" ? "font-bold font-serif text-base" : ""}>{t.icon}</span>
//                 <span className="text-[8px] uppercase tracking-wider leading-none opacity-70">{t.label}</span>
//               </button>
//             ))}
//           </div>

//           {/* Brush size */}
//           <div className="bg-stone-900 border border-stone-800 rounded-xl p-2 flex flex-col gap-1">
//             <p className="text-stone-600 text-[9px] uppercase tracking-widest text-center mb-1">Size</p>
//             {BRUSH_SIZES.map((s) => (
//               <button
//                 key={s}
//                 onClick={() => setBrushSize(s)}
//                 className={`w-full h-7 rounded-lg flex items-center justify-center transition-all border ${
//                   brushSize === s
//                     ? "border-amber-500 bg-stone-800"
//                     : "border-transparent hover:bg-stone-800"
//                 }`}
//               >
//                 <span
//                   className="rounded-full bg-stone-300 transition-all"
//                   style={{ width: Math.min(s * 2, 28), height: Math.min(s * 2, 28) }}
//                 />
//               </button>
//             ))}
//           </div>
//         </div>

//         {/* Canvas area */}
//         <div className="flex-1 flex flex-col gap-3">
//           <div
//             className="relative rounded-xl overflow-hidden border border-stone-700 shadow-2xl shadow-black/60"
//             style={{ cursor: getCursor() }}
//           >
//             <canvas
//               ref={canvasRef}
//               width={1200}
//               height={700}
//               className="w-full block"
//               onMouseDown={startDraw}
//               onMouseMove={draw}
//               onMouseUp={stopDraw}
//               onMouseLeave={stopDraw}
//               onTouchStart={startDraw}
//               onTouchMove={draw}
//               onTouchEnd={stopDraw}
//             />

//             {/* Text input overlay */}
//             {textInput.visible && (
//               <div
//                 className="absolute"
//                 style={{
//                   left: `${(textInput.x / 1200) * 100}%`,
//                   top: `${(textInput.y / 700) * 100}%`,
//                   transform: "translateY(-100%)",
//                 }}
//               >
//                 <input
//                   ref={inputRef}
//                   type="text"
//                   value={textInput.value}
//                   onChange={(e) => setTextInput((t) => ({ ...t, value: e.target.value }))}
//                   onKeyDown={(e) => {
//                     if (e.key === "Enter") commitText();
//                     if (e.key === "Escape") setTextInput({ visible: false, x: 0, y: 0, value: "" });
//                   }}
//                   onBlur={commitText}
//                   placeholder="Type & press Enter…"
//                   className="bg-white/90 text-stone-900 border-2 border-amber-400 rounded px-2 py-1 text-sm outline-none shadow-lg min-w-32"
//                   style={{ fontSize: Math.max(brushSize * 4 + 12, 14) + "px", fontFamily: "Georgia, serif" }}
//                 />
//               </div>
//             )}
//           </div>

//           {/* Color palette */}
//           <div className="bg-stone-900 border border-stone-800 rounded-xl p-3 flex items-center gap-3">
//             <p className="text-stone-600 text-[9px] uppercase tracking-widest shrink-0">Color</p>
//             <div className="flex gap-2 flex-wrap">
//               {COLORS.map((c) => (
//                 <button
//                   key={c}
//                   onClick={() => setColor(c)}
//                   className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
//                     color === c ? "border-amber-400 scale-110 shadow-md" : "border-stone-700"
//                   }`}
//                   style={{ backgroundColor: c }}
//                 />
//               ))}
//               <div className="flex items-center gap-1.5 ml-2 border-l border-stone-700 pl-3">
//                 <span className="text-stone-500 text-[9px] uppercase tracking-wider">Custom</span>
//                 <input
//                   type="color"
//                   value={color}
//                   onChange={(e) => setColor(e.target.value)}
//                   className="w-7 h-7 rounded-full cursor-pointer border-2 border-stone-700 bg-transparent"
//                 />
//               </div>
//             </div>

//             {/* Active tool indicator */}
//             <div className="ml-auto flex items-center gap-2 text-stone-500 text-xs">
//               <span className="text-amber-400">{TOOLS.find((t) => t.id === tool)?.icon}</span>
//               <span className="capitalize">{tool}</span>
//               <span className="text-stone-700">·</span>
//               <span>{brushSize}px</span>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Hint bar */}
//       <div className="w-full max-w-5xl mt-3 flex gap-4 text-stone-700 text-[10px] uppercase tracking-widest">
//         <span>✏️ Draw freely</span>
//         <span>·</span>
//         <span>T Click to place text, Enter to confirm</span>
//         <span>·</span>
//         <span>🪣 Click to flood fill</span>
//         <span>·</span>
//         <span>⬜ Erase marks</span>
//         <span>·</span>
//         <span>⌘Z Undo / ⌘Y Redo</span>
//       </div>
//     </div>
//   );
// }
