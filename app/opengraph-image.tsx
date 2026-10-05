import { ImageResponse } from "next/og";

export const alt = "Last.fm Toolbox";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #f13a33, #b90802)",
          color: "#dddddd",
          fontSize: 140,
          fontWeight: 300,
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        last.fm toolbox
      </div>
    ),
    size,
  );
}
