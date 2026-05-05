import Image from "next/image";

export default function MatchmakeLogo({ className = "", height = 40 }) {
  return (
    <Image
      alt="Matchmake"
      src="/matchmake-logo.png"
      width={height}
      height={height}
      priority
      className={className}
      style={{ height, width: "auto" }}
    />
  );
}
