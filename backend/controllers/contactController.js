const catchAsync = require('../src/utils/catchAsync');
const responseHandler = require('../src/utils/responseHandler');
const ContactMessage = require('../src/models/ContactMessage');
const NotFoundError = require('../src/utils/errors').NotFoundError;
const { emitToAdmins } = require('../src/services/socketService');

// POST /api/contact — public. Persists a customer contact enquiry in MongoDB.
const createMessage = catchAsync(async (req, res) => {
  // The contactValidator middleware has already trimmed/validated the payload.
  const { name, phone, email, message } = req.body;

  const contactMessage = await ContactMessage.create({ name, phone, email, message });

  // Admin-only notification; the payload is the persisted document.
  emitToAdmins('contact_message_created', { message: contactMessage });

  responseHandler.success(
    res,
    201,
    { message: contactMessage },
    'Your message has been sent successfully'
  );
});

// GET /api/contact/unread-count — admin. Used by the admin dashboard card.
// NOTE: defined before GET /:id in contactRoutes so "unread-count" is not
// swallowed as an :id parameter.
const getUnreadCount = catchAsync(async (req, res) => {
  const unread = await ContactMessage.countDocuments({ isRead: false });
  responseHandler.success(res, 200, { unread }, 'Unread count retrieved successfully');
});

// GET /api/contact?page&limit&isRead — admin. Paginated message list.
const listMessages = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, isRead } = req.query;

  const filter = {};
  if (isRead === 'true' || isRead === 'false') {
    filter.isRead = isRead === 'true';
  }

  const skip = (Number(page) - 1) * Number(limit);

  const messages = await ContactMessage.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await ContactMessage.countDocuments(filter);

  responseHandler.success(res, 200, {
    messages,
    totalPages: Math.ceil(total / Number(limit)) || 1,
    currentPage: Number(page),
    total,
  }, 'Messages retrieved successfully');
});

// GET /api/contact/:id — admin. A single message with all fields.
const getMessage = catchAsync(async (req, res) => {
  const message = await ContactMessage.findById(req.params.id);
  if (!message) {
    throw new NotFoundError('Contact message');
  }
  responseHandler.success(res, 200, { message }, 'Message retrieved successfully');
});

// PUT /api/contact/:id/read — admin. Body { isRead: boolean } toggles the flag.
const setMessageRead = catchAsync(async (req, res) => {
  const { isRead = true } = req.body;

  const message = await ContactMessage.findByIdAndUpdate(
    req.params.id,
    { isRead: Boolean(isRead) },
    { new: true, runValidators: true }
  );
  if (!message) {
    throw new NotFoundError('Contact message');
  }

  emitToAdmins('contact_message_updated', { message });

  responseHandler.success(res, 200, { message }, 'Message updated successfully');
});

// DELETE /api/contact/:id — admin.
const deleteMessage = catchAsync(async (req, res) => {
  const message = await ContactMessage.findByIdAndDelete(req.params.id);
  if (!message) {
    throw new NotFoundError('Contact message');
  }

  emitToAdmins('contact_message_deleted', { id: req.params.id });

  responseHandler.success(res, 200, { id: req.params.id }, 'Message deleted successfully');
});

module.exports = {
  createMessage,
  getUnreadCount,
  listMessages,
  getMessage,
  setMessageRead,
  deleteMessage,
};
