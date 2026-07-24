/**
 * Centralized Theme File
 * 
 * This file contains reusable, semantic class string combinations to ensure consistent
 * styling across the Maaz Hotel Booking frontend. It complements tailwind.config.js
 * by providing structural and layout classes that can be merged with `cn()`.
 */

export const theme = {
  layout: {
    container: "container mx-auto px-4 py-8 max-w-7xl",
    section: "py-12 space-y-6",
    pageHeader: "mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4",
  },
  card: {
    base: "bg-card rounded-2xl border border-border shadow-soft",
    interactive: "bg-card rounded-2xl shadow-soft hover:shadow-large transition-all duration-300 border border-border overflow-hidden",
    header: "p-6 border-b border-border",
    body: "p-6",
    footer: "p-6 border-t border-border bg-muted/30 rounded-b-2xl",
  },
  typography: {
    h1: "text-3xl font-bold tracking-tight text-foreground",
    h2: "text-2xl font-semibold text-foreground",
    h3: "text-xl font-semibold text-foreground",
    body: "text-foreground",
    muted: "text-sm text-muted-foreground",
    label: "text-sm font-medium text-foreground",
  },
  form: {
    group: "space-y-4",
    field: "space-y-1.5",
    input: "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    error: "text-sm font-medium text-destructive",
  },
  badges: {
    primary: "bg-primary text-primary-foreground rounded-full px-3 py-1 text-sm font-medium",
    secondary: "bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-sm font-medium",
    accent: "bg-accent text-accent-foreground rounded-full px-3 py-1 text-sm font-medium",
    success: "bg-success text-success-foreground rounded-full px-3 py-1 text-sm font-medium",
    warning: "bg-warning text-warning-foreground rounded-full px-3 py-1 text-xs font-medium",
    danger: "bg-danger text-danger-foreground rounded-full px-3 py-1 text-xs font-medium",
  },
  buttons: {
    primary: "bg-primary-action text-white hover:bg-primary-hover transition-colors rounded-md px-4 py-2 font-medium",
    gold: "bg-accent text-white hover:bg-accent-hover transition-colors rounded-md px-4 py-2 font-medium",
    outline: "border border-border text-foreground hover:bg-muted transition-colors rounded-md px-4 py-2 font-medium",
  },
  utils: {
    glass: "bg-background/90 backdrop-blur-sm",
    flexCenter: "flex items-center justify-center",
    flexBetween: "flex items-center justify-between",
  }
};
