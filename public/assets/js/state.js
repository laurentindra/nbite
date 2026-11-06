/* Single source of truth for UI state and the data loaded from the API. */

export const data = {
  listings: [],
  orders: []
};

export const defaultFilters = () => ({ max: 0, dist: 0, time: '' });

export const S = {
  user: null,
  partner: null,
  ready: false,

  /* auth forms */
  next: '',
  authErr: {},
  authVals: {},
  partnerAuthErr: {},

  /* catalogue */
  cat: 'All',
  q: '',
  view: 'list',
  f: defaultFilters(),
  sort: 'Nearest',
  favs: new Set(),
  mapSel: 1,

  /* deal and checkout */
  sel: 1,
  qty: 1,
  pay: 'cash',
  agree: true,
  busy: false,
  failMsg: '',

  /* orders */
  tab: 'Upcoming',
  ord: null,        // order just created at checkout
  viewOrder: null,  // order currently open on the "Pickup details" page

  /* overlays */
  modal: null,
  drawer: false,

  /* messaging */
  chats: [],
  currentChat: null,
  chatMessages: [],
  partnerListings: [],
  partnerChats: [],
  currentPartnerChat: null,
  partnerChatMessages: [],

  keepScroll: false
};

export const byId = id => data.listings.find(l => l.id == id);
