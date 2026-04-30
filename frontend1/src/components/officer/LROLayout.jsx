/**
 * LROLayout.jsx
 * ─────────────────────────────────────────────────────────────
 * Compatibility bridge — OfficerDashboard imports from './LROLayout'
 * while all other officer components import from './OfficerLayout'.
 * Both resolve to the same unified-card layout shell.
 * ─────────────────────────────────────────────────────────────
 */
import OfficerLayout, {
  T,
  S,
  fmt,
  fmtCnic,
  fmtDate,
  fmtDateTime,
  StatusBadge,
  DEFAULT_LRO_NAV_LINKS,
} from './OfficerLayout';

export { T, S, fmt, fmtCnic, fmtDate, fmtDateTime, StatusBadge, DEFAULT_LRO_NAV_LINKS };
export default OfficerLayout;