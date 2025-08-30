import { useEffect, useState } from "react";
import { getTodaySigilSvg } from "../utils/kairosMath";

export default function KairosWallpaperRenderer() {
  const [sigilSvg, setSigilSvg] = useState<string>("");

  useEffect(() => {
    const svg = getTodaySigilSvg(); // returns string of dynamic SVG
    setSigilSvg(svg);
  }, []);

  return (
    <div
      style={{
        background: "black",
        height: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      dangerouslySetInnerHTML={{ __html: sigilSvg }}
    />
  );
}
