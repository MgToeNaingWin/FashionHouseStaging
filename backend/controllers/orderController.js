const catchAsync = require('../src/utils/catchAsync');
const responseHandler = require('../src/utils/responseHandler');
const orderService = require('../src/services/orderService');
const { emitToAdmins, emitToUser, emitToAll } = require('../src/services/socketService');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const AppError = require('../src/utils/errors').AppError;
const NotFoundError = require('../src/utils/errors').NotFoundError;
const ValidationError = require('../src/utils/errors').ValidationError;

// Attach the customer's public identity to a plain order object so admin
// clients can display name/email without an extra query per row.
const withCustomerInfo = async (order, fallbackUser) => {
  const plain = order && typeof order.toJSON === 'function' ? order.toJSON() : order;
  let customer = fallbackUser || null;
  if (!customer && plain && plain.userId) {
    customer = await User.findById(plain.userId).select('username email');
  }
  if (customer) {
    plain.userId = {
      _id: customer._id || customer.id,
      username: customer.username,
      email: customer.email,
    };
  }
  return plain;
};

// The order service mutates variant stock directly on the Product documents.
// Re-read them AFTER persistence and broadcast the authoritative state so
// storefront pages (Shop, ProductDetail) show the real stock immediately.
const broadcastProductsForOrder = async (items = []) => {
  const productIds = [...new Set((items || []).map((it) => String(it.productId)))].filter(Boolean);
  if (productIds.length === 0) return;
  const products = await Product.find({ _id: { $in: productIds } });
  products.forEach((product) => emitToAll('product_updated', { product }));
};

const createOrder = catchAsync(async (req, res) => {
  if (!req.user) {
    responseHandler.error(res, 401, 'Not authenticated');
    return;
  }

  const { deliveryFee, discount, shippingAddress, notes, paymentMethod } = req.body;

  // Create order from cart using service
  const order = await orderService.createOrderFromCart(req.user.id, {
    deliveryFee,
    discount,
    shippingAddress,
    notes,
    paymentMethod,
  });

  // Real-time: notify connected admins only AFTER the order is persisted.
  emitToAdmins('new_order', { order: await withCustomerInfo(order, req.user) });

  // Stock was decremented and the cart was deleted by the service. Broadcast
  // the persisted consequences so every other tab/device reconciles.
  await broadcastProductsForOrder(order.items);
  emitToUser(req.user.id, 'cart_updated', { cart: { items: [], totalAmount: 0 } });
  emitToUser(req.user.id, 'order_created', { order: order.toJSON() });

  responseHandler.success(res, 201, { order }, 'Order created successfully');
});

const getMyOrders = catchAsync(async (req, res) => {
  if (!req.user) {
    responseHandler.error(res, 401, 'Not authenticated');
    return;
  }

  const orders = await orderService.getCustomerOrders(req.user.id, {
    page: req.query.page,
    limit: req.query.limit,
  });

  responseHandler.success(res, 200, orders, 'Orders retrieved successfully');
});

const getMyOrderById = catchAsync(async (req, res) => {
  if (!req.user) {
    responseHandler.error(res, 401, 'Not authenticated');
    return;
  }

  const orderId = req.params.orderId || req.params.id;

  if (!orderId) {
    responseHandler.error(res, 400, 'Order ID is required');
    return;
  }

  // Validate ownership first
  const order = await orderService.validateOrderOwnership(orderId, req.user.id);

  // Get detailed order information
  const orderDetails = await orderService.getOrderDetails(orderId);

  responseHandler.success(res, 200, { order: orderDetails }, 'Order retrieved successfully');
});

const cancelOrder = catchAsync(async (req, res) => {
  if (!req.user) {
    responseHandler.error(res, 401, 'Not authenticated');
    return;
  }

  const orderId = req.params.orderId || req.params.id;
  const { reason } = req.body;

  if (!orderId) {
    responseHandler.error(res, 400, 'Order ID is required');
    return;
  }

  // Validate ownership
  const order = await orderService.validateOrderOwnership(orderId, req.user.id);

  // Check if order can be cancelled
  if (order.orderStatus === 'shipped' || order.orderStatus === 'delivered') {
    responseHandler.error(res, 400, 'Cannot cancel order. Order has been shipped or delivered.');
    return;
  }

  // Cancel order using service
  const cancelledOrder = await orderService.cancelOrder(orderId, req.user.id, { reason });

  // Real-time: admins see the customer's cancellation immediately.
  emitToAdmins('order_updated', { order: await withCustomerInfo(cancelledOrder, req.user) });

  // The owner's other tabs/devices and every storefront viewer see the
  // restored stock and the new status without a refresh.
  emitToUser(cancelledOrder.userId, 'order_updated', { order: cancelledOrder.toJSON() });
  await broadcastProductsForOrder(cancelledOrder.items);

  responseHandler.success(res, 200, { order: cancelledOrder }, 'Order cancelled successfully');
});

const getAllOrders = catchAsync(async (req, res) => {
  // Admin only - will check role in middleware
  const { page = 1, limit = 10, status } = req.query;

  const filters = {};
  if (status) filters.orderStatus = status;

  const orders = await orderService.getAllOrdersWithFilters(filters, {
    page: Number(page),
    limit: Number(limit),
  });

  responseHandler.success(res, 200, orders, 'Orders retrieved successfully');
});

const getOrderById = catchAsync(async (req, res) => {
  const orderId = req.params.orderId || req.params.id;

  if (!orderId) {
    responseHandler.error(res, 400, 'Order ID is required');
    return;
  }

  // Get order details
  const order = await orderService.getOrderById(orderId);

  responseHandler.success(res, 200, { order }, 'Order retrieved successfully');
});

const updateOrderStatus = catchAsync(async (req, res) => {
  const orderId = req.params.id || req.params.orderId;
  const { status } = req.body;

  if (!orderId) {
    responseHandler.error(res, 400, 'Order ID is required');
    return;
  }
  if (!status) {
    responseHandler.error(res, 400, 'Order status is required');
    return;
  }

  const order = await orderService.updateOrderStatus(orderId, status);

  // Real-time: every admin view (orders list, dashboard counts) stays in sync.
  emitToAdmins('order_status_changed', { order: await withCustomerInfo(order) });

  // The order owner's Orders/OrderDetail pages update without a refresh.
  emitToUser(order.userId, 'order_status_changed', { order: order.toJSON() });

  responseHandler.success(res, 200, { order }, 'Order status updated successfully');
});

module.exports = {
  createOrder,
  getMyOrders,
  getMyOrderById,
  cancelOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
};