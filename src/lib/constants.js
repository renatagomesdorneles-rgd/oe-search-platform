export const PIPELINE_STAGES = {
  1: { label: 'Application Received', color: '#0B6E6E', owner: 'PM' },
  2: { label: 'Application Review', color: '#0D5F8A', owner: 'PM' },
  3: { label: 'Screened — 1st Interview', color: '#6B46C1', owner: 'PM / Research Lead' },
  4: { label: 'Screened — 2nd Interview', color: '#B7791F', owner: 'Client Lead' },
  5: { label: 'Pending Client Presentation', color: '#C05621', owner: 'Client Lead' },
  6: { label: 'Submitted to Client', color: '#276749', owner: 'Client Lead + PM' },
  7: { label: 'Client Interview', color: '#2C5282', owner: 'Client (Search Committee)' },
  8: { label: 'Reference Check', color: '#553C9A', owner: 'PM' },
  9: { label: 'Offer Extended', color: '#2D3748', owner: 'Client Lead' },
  10: { label: 'Placed', color: '#1A365D', owner: 'Client Lead' },
}

export const REJECTION_REASONS = {
  does_not_meet_qualifications: 'Does not meet minimum qualifications',
  insufficient_experience: 'Insufficient relevant experience',
  location_relocation: 'Location / relocation not viable',
  withdrew: 'Withdrew / no longer interested',
  other: 'Other',
}

export const RECOMMENDATION_LABELS = {
  strong_yes: 'Strong Yes',
  yes: 'Yes',
  maybe: 'Maybe',
  no: 'No',
}

export const RECOMMENDATION_COLORS = {
  strong_yes: '#276749',
  yes: '#2C7A7B',
  maybe: '#B7791F',
  no: '#9B2C2C',
}

// Stages where Not Proceeding + rejection email are available
export const NOT_PROCEEDING_ELIGIBLE_STAGES = [1, 2, 3, 4, 5]

// Stages where aging clock runs
export const AGING_STAGES = [1, 2]

export const AGING_AMBER_DAYS = 5
export const AGING_RED_DAYS = 10

export function getAgingStatus(stageEnteredAt, currentStage) {
  if (!AGING_STAGES.includes(currentStage)) return 'normal'
  const days = Math.floor((Date.now() - new Date(stageEnteredAt)) / (1000 * 60 * 60 * 24))
  // Approximate business days (simple: multiply calendar days by 5/7)
  const bizDays = Math.floor(days * (5 / 7))
  if (bizDays >= AGING_RED_DAYS) return 'red'
  if (bizDays >= AGING_AMBER_DAYS) return 'amber'
  return 'normal'
}

export function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
