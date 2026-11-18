import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import UserNavbar from '../components/UserNavbar';
import UserFooter from '../components/UserFooter';
import { getSocket } from '../services/socket.js';
import { useAppDispatch, useAppSelector } from '../hooks/useAppSelector';
import { selectIsAuthenticated } from '../features/auth/authSlice.jsx';
import { updateUserLocal } from '../features/auth/authSlice.jsx';
import { setCartItems, normalizeServerCart } from '../features/cart/cartSlice.jsx';
import { setWishlistItems, normalizeServerWishlist } from '../features/wishlist/wishlistSlice.jsx';
import { cartApi, wishlistApi } from '../services/baseApi.jsx';

const UserLayout = () => {
  const dispatch = useAppDispatch();
  const isAuthed = useAppSelector(selectIsAuthenticated);

  // One shared socket for all storefront pages. The server only emits cart /
  // wishlist / profile data into the owner's `user:<id>` room, so a guest
  // connection simply never receives them. Reconnecting whenever the auth
  // state flips makes the handshake pick up (or drop) the session cookie.
  useEffect(() => {
    const socket = getSocket();

    const onCartUpdated = (payload) => {
      if (payload?.cart) dispatch(setCartItems(normalizeServerCart(payload.cart)));
    };
    const onWishlistUpdated = (payload) => {
      if (payload?.wishlist) dispatch(setWishlistItems(normalizeServerWishlist(payload.wishlist)));
    };
    const onProfileUpdated = (payload) => {
      if (payload?.user) dispatch(updateUserLocal(payload.user));
    };

    // Cart / wishlist changes made while the socket was offline are missed, so
    // reconcile from the server after a reconnect (silent, no loading flags).
    let hasConnected = socket.connected;
    const onConnect = async () => {
      if (!hasConnected) {
        hasConnected = true;
        return;
      }
      try {
        const [cartData, wishData] = await Promise.all([cartApi.get(), wishlistApi.get()]);
        if (cartData?.cart) dispatch(setCartItems(normalizeServerCart(cartData.cart)));
        if (wishData?.wishlist) dispatch(setWishlistItems(normalizeServerWishlist(wishData.wishlist)));
      } catch {
        /* keep the last known state */
      }
    };

    socket.on('cart_updated', onCartUpdated);
    socket.on('wishlist_updated', onWishlistUpdated);
    socket.on('profile_updated', onProfileUpdated);
    socket.on('connect', onConnect);

    socket.connect();

    return () => {
      socket.off('cart_updated', onCartUpdated);
      socket.off('wishlist_updated', onWishlistUpdated);
      socket.off('profile_updated', onProfileUpdated);
      socket.off('connect', onConnect);
      socket.disconnect();
    };
  }, [dispatch, isAuthed]);

  return (
    // Dark Mode အတွက် နောက်ခံအရောင် ပြောင်းပေးထားတယ်
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 transition-colors duration-300">
      
      <UserNavbar />

      <main className="flex-grow">
        <Outlet />
      </main>

      <UserFooter />
      
    </div>
  );
};

export default UserLayout;
