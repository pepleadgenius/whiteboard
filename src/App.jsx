import { useState, useRef, useEffect, useCallback } from "react";

const TOOLS = [
  { id: "pencil", label: "Pencil", icon: "✏️" },
  { id: "text", label: "Text", icon: "T" },
  { id: "paint", label: "Paint", icon: "🪣" },
  { id: "eraser", label: "Eraser", icon: "⬜" },
];

const COLORS = [
  "#0f172a", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899",
  "#ffffff", "#64748b", "#000000",
];

const BRUSH_SIZES = [2, 5, 10, 20, 40];

export default function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<"pencil" | "text" | "paint" | "eraser">("pencil");
  const [color, setColor] = useState("#0f172a");
  const [brushSize, setBrushSize] = useState(5);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);
  const [textInput, setTextInput] = useState({ visible: false, x: 0, y: 0, value: "" });
  const [isDarkMode, setIsDarkMode] = useState(true); // CV Light = light canvas, dark UI is separate

  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize canvas with CV Light mode (clean white background)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = 1600;
    canvas.height = 900;

    ctx.fillStyle = "#ffffff"; // Pure white for CV Light mode
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveHistory();
  }, []);

  // Focus text input when visible
  useEffect(() => {
    if (textInput.visible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [textInput.visible]);

  // Dark mode toggle for UI (canvas stays light)
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const saveHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev.slice(-29), imageData]);
    setRedoStack([]);
  }, []);

  const undo = () => {
    if (history.length < 2) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const newHistory = [...history];
    const current = newHistory.pop()!;
    setRedoStack((r) => [...r, current]);
    setHistory(newHistory);
    ctx.putImageData(newHistory[newHistory.length - 1], 0, 0);
  };

  const redo = () => {
    if (!redoStack.length) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const newRedo = [...redoStack];
    const next = newRedo.pop()!;
    setRedoStack(newRedo);
    setHistory((h) => [...h, next]);
    ctx.putImageData(next, 0, 0);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveHistory();
  };

  const floodFill = (ctx: CanvasRenderingContext2D, x: number, y: number, fillColor: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const w = canvas.width;
    const h = canvas.height;

    const startIdx = (Math.floor(x) + Math.floor(y) * w) * 4;
    const targetR = data[startIdx], targetG = data[startIdx + 1], targetB = data[startIdx + 2], targetA = data[startIdx + 3];

    const hex = fillColor.replace("#", "");
    const fillR = parseInt(hex.slice(0, 2), 16);
    const fillG = parseInt(hex.slice(2, 4), 16);
    const fillB = parseInt(hex.slice(4, 6), 16);

    if (targetR === fillR && targetG === fillG && targetB === fillB) return;

    const stack: number[] = [Math.floor(x) + Math.floor(y) * w];
    const visited = new Uint8Array(w * h);

    while (stack.length) {
      const idx = stack.pop()!;
      if (idx < 0 || idx >= w * h || visited[idx]) continue;

      const i = idx * 4;
      if (
        Math.abs(data[i] - targetR) > 25 ||
        Math.abs(data[i + 1] - targetG) > 25 ||
        Math.abs(data[i + 2] - targetB) > 25 ||
        Math.abs(data[i + 3] - targetA) > 25
      ) continue;

      visited[idx] = 1;
      data[i] = fillR;
      data[i + 1] = fillG;
      data[i + 2] = fillB;
      data[i + 3] = 255;

      stack.push(idx + 1, idx - 1, idx + w, idx - w);
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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
    ctx.arc(
      pos.x,
      pos.y,
      tool === "eraser" ? brushSize * 1.5 : brushSize / 2,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.fill();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing || !lastPos.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pos = getPos(e, canvas);

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.lineWidth = tool === "eraser" ? brushSize * 2.5 : brushSize;
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
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.font = `${brushSize * 3 + 18}px Georgia, serif`;
    ctx.fillStyle = color;
    ctx.fillText(textInput.value, textInput.x, textInput.y + 10);

    setTextInput({ visible: false, x: 0, y: 0, value: "" });
    saveHistory();
  };

  const downloadCanvas = () => {
    const link = document.createElement("a");
    link.download = "whiteboard.png";
    link.href = canvasRef.current!.toDataURL("image/png");
    link.click();
  };

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-zinc-950' : 'bg-zinc-100'} transition-colors duration-300 font-sans`}>
      {/* Top Bar */}
      <div className={`border-b ${isDarkMode ? 'border-zinc-800' : 'border-zinc-200'} py-3 px-6 flex items-center justify-between sticky top-0 z-50 ${isDarkMode ? 'bg-zinc-950/80' : 'bg-white/80'} backdrop-blur-md`}>
        <div className="flex items-center gap-3">
          <div className="text-2xl font-bold tracking-tighter text-amber-500">ANNO</div>
          <div className="text-xs uppercase tracking-[2px] text-zinc-500">Whiteboard</div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleDarkMode}
            className={`px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-all ${isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-white shadow border border-zinc-200 hover:bg-zinc-50'}`}
          >
            {isDarkMode ? "☀️ Light" : "🌙 Dark"}
          </button>

          <button onClick={undo} disabled={history.length < 2} className="toolbar-btn">↩ Undo</button>
          <button onClick={redo} disabled={!redoStack.length} className="toolbar-btn">↪ Redo</button>
          <button onClick={clearCanvas} className="toolbar-btn text-red-400 hover:text-red-500">Clear</button>
          <button onClick={downloadCanvas} className="toolbar-btn text-amber-500 hover:text-amber-600">↓ Save</button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Toolbar */}
        <div className={`w-20 border-r ${isDarkMode ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-white'} flex flex-col items-center py-6 gap-6`}>
          <div className="space-y-2">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTool(t.id as any)}
                className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 text-xl transition-all hover:scale-105 ${tool === t.id
                  ? "bg-amber-500 text-white shadow-lg shadow-amber-500/50"
                  : isDarkMode
                    ? "hover:bg-zinc-800 text-zinc-400"
                    : "hover:bg-zinc-100 text-zinc-600"
                  }`}
              >
                <span>{t.icon}</span>
                <span className="text-[9px] tracking-widest uppercase">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Brush Sizes */}
          <div className="w-full px-3">
            <p className={`text-center text-[10px] uppercase tracking-widest mb-3 ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>Size</p>
            <div className="flex flex-col gap-3 items-center">
              {BRUSH_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => setBrushSize(size)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border ${brushSize === size ? "border-amber-500 bg-amber-500/10" : isDarkMode ? "border-zinc-700 hover:border-zinc-500" : "border-zinc-200 hover:border-zinc-400"}`}
                >
                  <div
                    className="rounded-full bg-current"
                    style={{ width: Math.min(size * 1.8, 26), height: Math.min(size * 1.8, 26) }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Canvas Container */}
        <div className="flex-1 flex items-center justify-center bg-[#f8fafc] dark:bg-zinc-900 overflow-auto p-8 relative">
          <div className="relative shadow-2xl rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
            <canvas
              ref={canvasRef}
              className="block rounded-3xl"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />

            {/* Floating Text Input */}
            {textInput.visible && (
              <div
                className="absolute pointer-events-auto"
                style={{
                  left: `${(textInput.x / 1600) * 100}%`,
                  top: `${(textInput.y / 900) * 100}%`,
                  transform: "translate(-50%, -120%)",
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={textInput.value}
                  onChange={(e) => setTextInput((prev) => ({ ...prev, value: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitText();
                    if (e.key === "Escape") setTextInput({ visible: false, x: 0, y: 0, value: "" });
                  }}
                  onBlur={commitText}
                  className="bg-white dark:bg-zinc-900 border-2 border-amber-400 rounded-xl px-4 py-2 text-lg shadow-xl outline-none min-w-[200px]"
                  style={{ fontFamily: "Georgia, serif", fontSize: `${brushSize * 3 + 18}px` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Colors */}
        <div className={`w-72 border-l ${isDarkMode ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-white'} p-6 flex flex-col`}>
          <div>
            <p className={`uppercase text-xs tracking-widest mb-4 ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>Colors</p>
            <div className="grid grid-cols-5 gap-3">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-2xl border-2 transition-all hover:scale-110 ${color === c ? "border-amber-400 scale-110 shadow-lg" : isDarkMode ? "border-zinc-700" : "border-zinc-200"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="mt-8">
            <p className={`uppercase text-xs tracking-widest mb-3 ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>Custom Color</p>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full h-12 rounded-2xl overflow-hidden cursor-pointer border border-zinc-700"
            />
          </div>

          <div className="mt-auto pt-8 text-center">
            <div className="text-xs text-zinc-500">
              Current: <span className="font-mono">{color}</span> • {brushSize}px
            </div>
          </div>
        </div>
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
