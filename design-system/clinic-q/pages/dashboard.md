# Dashboard Page — Design System Override

> Overrides MASTER.md for the Dashboard page

---

## PATTERN: Health Summary Dashboard

- **Layout:** Stats grid (4 cols) → Queue table (2/3) + Clinic types (1/3) → Quick actions (3 cols)
- **Density:** Medium (standard spacing)

---

## LAYOUT STRUCTURE

```
┌─────────────────────────────────────────────────────┐
│  Page Header: Title + Export + Create Queue CTA     │
├──────┬──────┬──────┬────────────────────────────────┤
│ Stat │ Stat │ Stat │  Stat                         │
│ Wait │ Serve│ Done │  Avg Time                     │
├──────┴──────┴──────┴────────────────────────────────┤
│  Queue Table (2/3)    │  Clinic Types List (1/3)    │
│  - Search + Filters   │  - 6 clinic types           │
│  - Queue items        │  - Patient count per type   │
│  - Status badges      │  - Color-coded              │
├───────────────────────┴─────────────────────────────┤
│  Quick Actions (3 cards)                            │
│  - Call Next Queue  │  - Register Patient  │ Stats  │
└─────────────────────────────────────────────────────┘
```

---

## SPECIFIC RULES

- Stats cards: 4-column grid on desktop, 2-column on mobile
- Queue table: Left-aligned status badges, right-aligned action buttons
- Clinic type list: Color-coded left borders matching clinic colors
- Quick action cards: Clickable, hover-lift effect, icon + text layout
- Export button: Secondary style (outlined), download CSV
- Create queue button: Primary style (filled), plus icon

---

## BREAKPOINTS

| Breakpoint | Stats Grid | Queue + Clinic | Quick Actions |
|------------|------------|----------------|---------------|
| Mobile (< 640px) | 2 columns | Stacked | Stacked |
| Tablet (640-1024px) | 2 columns | Stacked | 3 columns |
| Desktop (> 1024px) | 4 columns | Side-by-side | 3 columns |
