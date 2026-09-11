"use client";

import { createTheme } from "@mui/material/styles";

export const workflowTheme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#c64d37", contrastText: "#fff" },
        secondary: { main: "#465369" },
        background: { default: "#f6f7fa", paper: "#ffffff" },
        text: { primary: "#202636", secondary: "#667080" },
        divider: "#e8eaf0",
      },
    },
    dark: {
      palette: {
        primary: { main: "#f18b74", contrastText: "#202535" },
        secondary: { main: "#bac6da" },
        background: { default: "#151a25", paper: "#202637" },
        text: { primary: "#e8edf5", secondary: "#aab5c8" },
        divider: "#343e52",
      },
    },
  },
  typography: {
    fontFamily: '"Manrope", "Noto Sans Thai", sans-serif',
    fontSize: 14,
    button: { textTransform: "none", fontWeight: 650 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 38, gap: 8, borderRadius: 8 },
        outlined: { borderColor: "var(--input)" },
      },
    },
    MuiOutlinedInput: {
      defaultProps: { size: "small" },
      styleOverrides: {
        root: { fontSize: "0.875rem", background: "var(--card)" },
        input: { padding: "10px 12px" },
        notchedOutline: { borderColor: "var(--border)" },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { backgroundImage: "none", borderRadius: 16 } },
    },
    MuiDrawer: { styleOverrides: { paper: { backgroundImage: "none" } } },
    MuiMenu: {
      styleOverrides: {
        paper: {
          border: "1px solid var(--border)",
          borderRadius: 12,
          backgroundImage: "none",
        },
        list: { padding: 6 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { minHeight: 40, borderRadius: 6, fontSize: "0.875rem" },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: "var(--border)",
          padding: "16px 20px",
          fontSize: "0.875rem",
        },
        head: {
          color: "var(--muted-foreground)",
          background: "var(--muted)",
          fontWeight: 650,
          whiteSpace: "nowrap",
        },
      },
    },
    MuiTooltip: { defaultProps: { arrow: true } },
  },
});
