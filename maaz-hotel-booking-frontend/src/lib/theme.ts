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
    base: "bg-white rounded-2xl border border-gray-100 shadow-soft",
    interactive: "bg-white rounded-2xl shadow-soft hover:shadow-large transition-all duration-300 border border-gray-100 overflow-hidden",
    header: "p-6 border-b border-gray-100",
    body: "p-6",
    footer: "p-6 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl",
  },
  typography: {
    h1: "text-3xl font-bold tracking-tight text-gray-900",
    h2: "text-2xl font-semibold text-gray-900",
    h3: "text-xl font-semibold text-gray-800",
    body: "text-gray-700",
    muted: "text-sm text-muted-foreground",
    label: "text-sm font-medium text-gray-700",
  },
  form: {
    group: "space-y-4",
    field: "space-y-1.5",
    input: "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    error: "text-sm font-medium text-destructive",
  },
  badges: {
    primary: "bg-primary-600 text-white rounded-full px-3 py-1 text-sm font-medium",
    secondary: "bg-teal-500 text-white rounded-full px-3 py-1 text-sm font-medium",
    warning: "bg-yellow-500 text-white rounded-full px-3 py-1 text-xs font-medium",
  },
  utils: {
    glass: "bg-white/90 backdrop-blur-sm",
    flexCenter: "flex items-center justify-center",
    flexBetween: "flex items-center justify-between",
  }
};
