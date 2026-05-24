import React from "react";

interface Props {
  showTagline?: boolean;
}

const logoSrc = "assets/logo.png";

const styles: Record<string, React.CSSProperties> = {
  container: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
  },
  image: {
    width: 64,
    height: 64,
    marginBottom: 8,
    objectFit: "contain",
  },
  logoText: {
    fontSize: 44,
    fontWeight: "bold",
    color: "#d4af37",
    letterSpacing: 10,
  },
  tagline: {
    fontSize: 12,
    color: "rgba(212,175,55,0.55)",
    letterSpacing: 3,
    marginTop: 2,
    marginBottom: 14,
  },
};

export default function SkiaLogo({ showTagline = true }: Props) {
  return (
    <div style={styles.container}>
      <img src={logoSrc} alt="SKIA" style={styles.image} />
      <div style={styles.logoText}>SKIA</div>
      {showTagline ? <div style={styles.tagline}>She Knows It All</div> : null}
    </div>
  );
}
