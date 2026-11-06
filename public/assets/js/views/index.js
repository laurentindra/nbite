/* Route name -> view function. Unknown routes fall back to the home page. */
import { home } from './home.js';
import { explore } from './explore.js';
import { deal } from './deal.js';
import { checkout } from './checkout.js';
import { success, orders, order } from './orders.js';
import { profile } from './profile.js';
import { login, register } from './auth.js';
import { partner, partnerDashboard } from './partner.js';
import { messages, chat, partnerChats, partnerChat } from './messaging.js';
import { statePage } from './state.js';

export const VIEWS = {
  home, explore, deal, checkout, success, orders, order, profile, login, register,
  partner,
  'partner-dashboard': partnerDashboard,
  messages, chat,
  'partner-chats': partnerChats,
  'partner-chat': partnerChat,
  state: statePage
};
