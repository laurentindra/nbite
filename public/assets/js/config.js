/* Static configuration: route groups, page titles, labels and user-facing runtime messages. */

export const SERVICE_FEE = 1000;
export const MAX_QTY = 5;
export const POLL_INTERVAL_MS = 5000;
export const TOAST_MS = 3200;

/* Pages that need a logged-in customer / Food Partner. */
export const AUTHED = ['checkout', 'success', 'orders', 'order', 'profile', 'messages', 'chat'];
export const PARTNERED = ['partner-dashboard', 'partner-chats', 'partner-chat'];

/* Routes that load extra data when entered (see data.js). */
export const ORDER_ROUTES = ['orders', 'order', 'profile', 'success', 'state', 'home'];
export const CHAT_ROUTES = ['messages', 'chat'];

export const FOOD_ART = ['bakery', 'bundle', 'meal', 'snack', 'cafe', 'noodle', 'sate', 'loaf'];

export const TITLES = {
  home: 'Night Bite',
  explore: 'Explore deals · Night Bite',
  deal: 'Deal · Night Bite',
  checkout: 'Checkout · Night Bite',
  success: 'Order confirmed · Night Bite',
  orders: 'My Orders · Night Bite',
  order: 'Pickup details · Night Bite',
  profile: 'Profile · Night Bite',
  messages: 'Messages · Night Bite',
  chat: 'Chat · Night Bite',
  partner: 'Food Partner · Night Bite',
  'partner-dashboard': 'Store dashboard · Night Bite',
  'partner-chats': 'Customer messages · Night Bite',
  'partner-chat': 'Customer chat · Night Bite',
  login: 'Log in · Night Bite',
  register: 'Create account · Night Bite',
  state: 'Night Bite'
};

/* Labels for the removable filter tags on the Explore page. */
export const TIME_FILTER_LABELS = {
  early: 'Starts before 19:00',
  late: 'Starts 19:00 or later',
  after20: 'Ends after 20:00'
};

export const MESSAGES = {
  loginRequiredSave: 'Log in to save deals.',
  loginRequiredChat: 'Log in to message this store.',
  partnerSessionExpired: 'Your Food Partner session expired. Please log in again.',
  partnerSessionExpiredShort: 'Your Food Partner session has expired. Please log in again.',
  sessionExpired: 'Your session expired. Please log in again.',
  welcomePartner: 'Welcome to the Food Partner workspace.',
  partnerLoggedOut: 'You have logged out from the Food Partner portal.',
  loggedOut: 'You are logged out.',
  accountReady: 'Your account is ready. Welcome to Night Bite.',
  packageAdded: 'Package added to your store.',
  packageUpdated: 'Package details updated.',
  notSupported: 'Geolocation is not supported by this browser.',
  locating: 'Requesting location permission…',
  locationDenied: 'Location permission was denied. Enable it in browser settings.',
  locationFailed: 'Could not determine your location. Try again.',
  locationReady: 'Your current location is available in this browser.',
  comingSoon: 'Coming soon'
};
