import { useState, useCallback, useEffect } from "react";

export function useResize(initial: number, min: number, max: number, side: "left" | "right") {
  const [size, setSize] = useState(initial);
  const [dragging, setDragging] = useState(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    const startX = e.clientX;
    const startSize = size;

    const onMove = (ev: MouseEvent) => {
      const delta = side === "left" ? ev.clientX - startX : startX - ev.clientX;
      setSize(Math.min(max, Math.max(min, startSize + delta)));
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [size, min, max, side]);

  useEffect(() => {
    if (dragging) document.body.style.cursor = "col-resize";
    else document.body.style.cursor = "";
    return () => { document.body.style.cursor = ""; };
  }, [dragging]);

  return { size, onMouseDown, dragging };
}
