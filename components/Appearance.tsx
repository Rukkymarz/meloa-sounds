"use client";

import { useEffect, useState } from "react";

export type ThemeChoice = "dark" | "light" | "auto";
export type AccentChoice = "rose" | "copper" | "violet" | "green";

const THEME_KEY = "meloa:theme";
const ACCENT_KEY = "meloa:accent";
const BG = { dark: "#0f0e11", light: "#faf5ec" } as const;

/** Runs in <head> before first paint so the page never flashes the wrong theme. */
export const themeBootScript = `(function(){try{
var t=localStorage.getItem("${THEME_KEY}")||"dark",a=localStorage.getItem("${ACCENT_KEY}")||"rose";
var r=t==="auto"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):t;
var d=document.documentElement;d.dataset.theme=r;d.dataset.accent=a;
var m=document.querySelector('meta[name="theme-color"]');if(m)m.content=r==="light"?"${BG.light}":"${BG.dark}";
}catch(e){document.documentElement.dataset.theme="dark";}})();`;

function apply(theme: ThemeChoice, accent: AccentChoice) {
  const resolved = theme === "auto" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : theme;
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.accent = accent;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", BG[resolved]));
}

function read<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback;
  } catch {
    return fallback;
  }
}

const THEMES: { id: ThemeChoice; label: string }[] = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "auto", label: "Automatic" },
];

const ACCENTS: { id: AccentChoice; label: string; color: string }[] = [
  { id: "rose", label: "Rose", color: "#f0566e" },
  { id: "copper", label: "Copper", color: "#c98443" },
  { id: "violet", label: "Violet", color: "#9b7bff" },
  { id: "green", label: "Green", color: "#3fcb7e" },
];

export function AppearancePicker() {
  const [theme, setTheme] = useState<ThemeChoice>("dark");
  const [accent, setAccent] = useState<AccentChoice>("rose");

  useEffect(() => {
    setTheme(read<ThemeChoice>(THEME_KEY, "dark"));
    setAccent(read<AccentChoice>(ACCENT_KEY, "rose"));
  }, []);

  // Follow the phone's setting live when Automatic is on.
  useEffect(() => {
    if (theme !== "auto") return;
    const mq = matchMedia("(prefers-color-scheme: light)");
    const on = () => apply("auto", accent);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [theme, accent]);

  function choose(nextTheme: ThemeChoice, nextAccent: AccentChoice) {
    setTheme(nextTheme);
    setAccent(nextAccent);
    try {
      localStorage.setItem(THEME_KEY, nextTheme);
      localStorage.setItem(ACCENT_KEY, nextAccent);
    } catch {
      /* storage blocked: the choice still applies until the page closes */
    }
    apply(nextTheme, nextAccent);
  }

  return (
    <section className="appearance" aria-labelledby="appearance-h">
      <h2 id="appearance-h" className="h-section">Appearance</h2>
      <div className="seg" role="group" aria-label="Theme">
        {THEMES.map((t) => (
          <button key={t.id} type="button" aria-pressed={theme === t.id} onClick={() => choose(t.id, accent)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="swatches" role="group" aria-label="Accent colour">
        {ACCENTS.map((a) => (
          <button key={a.id} type="button" className="swatch" aria-pressed={accent === a.id} onClick={() => choose(theme, a.id)}>
            <i style={{ background: a.color }} aria-hidden="true" />
            {a.label}
          </button>
        ))}
      </div>
    </section>
  );
}
