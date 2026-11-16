// Categories. Colors follow a validated categorical palette in fixed order;
// "Other" is neutral gray. Text labels always accompany color.
export const CATEGORIES = [
  { id: 'food', label: 'Food & Drinks', emoji: '🍜', color: '#2a78d6', dark: '#3987e5' },
  { id: 'transport', label: 'Transport', emoji: '🚕', color: '#eb6834', dark: '#d95926' },
  { id: 'stay', label: 'Stay', emoji: '🏨', color: '#1baf7a', dark: '#199e70' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️', color: '#eda100', dark: '#c98500' },
  { id: 'fun', label: 'Activities', emoji: '🎟️', color: '#e87ba4', dark: '#d55181' },
  { id: 'fuel', label: 'Fuel', emoji: '⛽', color: '#008300', dark: '#0ca30c' },
  { id: 'bills', label: 'Bills & Fees', emoji: '🧾', color: '#6250d6', dark: '#9085e9' },
  { id: 'other', label: 'Other', emoji: '💸', color: '#8a8984', dark: '#9b9a94' },
]

export const catById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))

const RULES = [
  ['food', /zomato|swiggy|shack|thali|momo|mess\b|lunch|dinner|breakfast|snack|eatsure|domino|pizza|mcdonald|kfc|burger|starbucks|cafe|coffee|chai|tea|restaurant|dhaba|bakery|food|kitchen|biryani|bar\b|pub|brew|haldiram|blinkit|zepto|instamart|dunzo|bigbasket|juice|sweets|canteen|hotel .*restaurant/i],
  ['transport', /uber|ola|rapido|irctc|redbus|abhibus|indigo|air ?india|spicejet|akasa|vistara|metro|railway|rail|cab|taxi|auto|bus|travels|yatra|makemytrip|goibibo|cleartrip|ixigo|fastag|toll|parking|zoomcar|bike rent|rental/i],
  ['stay', /oyo|airbnb|hotel|resort|inn\b|stay|hostel|zostel|booking\.com|agoda|treebo|fabhotel|homestay|lodge|villa|guest ?house|regency|residency/i],
  ['fuel', /petrol|diesel|fuel|indian ?oil|iocl|hpcl|bpcl|bharat petroleum|hp pay|shell|nayara|reliance bp|cng/i],
  ['shopping', /amazon|flipkart|myntra|ajio|nykaa|meesho|decathlon|mall|store|mart|shop|retail|fashion|lifestyle|trends|pantaloons|max\b|dmart|souvenir|emporium|handicraft/i],
  ['fun', /bookmyshow|ticket|museum|park|adventure|tour|trek|safari|paragliding|rafting|scuba|cruise|zoo|fort|palace|club|cinema|pvr|inox|entry|darshan|temple/i],
  ['bills', /recharge|airtel|jio|\bvi\b|vodafone|bsnl|electricity|insurance|fee|charges|pharmacy|apollo|medplus|hospital|clinic|medical|atm|forex/i],
]

export const keyOf = (merchant) => String(merchant || '').toLowerCase().replace(/[^a-z0-9]/g, '')

/** Guess a category. User corrections ("learned") always win. */
export function categorize(merchant, learned = {}, extra = '') {
  const k = keyOf(merchant)
  if (k && learned[k]) return learned[k]
  const hay = `${merchant} ${extra}`
  for (const [id, re] of RULES) if (re.test(hay)) return id
  return 'other'
}
