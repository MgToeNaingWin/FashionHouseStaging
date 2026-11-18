// Shared Socket.IO client used by BOTH the admin layout and the storefront.
//
// A single lazily-created connection is reused across the whole app, which
// prevents duplicate sockets (and therefore duplicate event listeners) when
// navigating between pages. The owning layout (AdminLayout / UserLayout)
// connects on mount and disconnects on unmount; pages only attach listeners in
// their effects and always detach them in the cleanup function.
//
// The handshake authenticates with the httpOnly `token`/`refreshToken` cookies
// (withCredentials), forwarded to the backend by the Vite dev proxy over the
// /socket.io entry in vite.config.js. The server decides room membership:
// guests and customers can only receive public catalog events plus their own
// `user:<id>` room data; administrative events go exclusively to `admins`.
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || ''

let socket = null

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL || undefined, {
      withCredentials: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
    })
  }
  return socket
}

// Backwards-compatible alias: existing admin pages/imports use getAdminSocket.
export const getAdminSocket = getSocket

export default getSocket
