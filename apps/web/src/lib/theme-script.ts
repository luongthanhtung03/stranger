// Plain (non-client) module so the server layout can read these values; a
// "use client" module would only hand it client references.

export type Theme = "dark" | "light";

export const KEY = "stranger.theme";
export const THEME_COLOR: Record<Theme, string> = { dark: "#0b0b12", light: "#f6f5fb" };

/** Runs in <head> during HTML parsing, so the wrong theme never flashes. */
export const themeScript = `(function(){try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="light"?"${THEME_COLOR.light}":"${THEME_COLOR.dark}")}}catch(e){}})()`;
