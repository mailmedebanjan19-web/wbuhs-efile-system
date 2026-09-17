const express = require('express');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

// Setup upload directory and storage
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

// View engine setup (supports both views and Views for Linux case-sensitivity)
app.set('view engine', 'ejs');
app.set('views', [
  path.join(__dirname, 'views'),
  path.join(__dirname, 'Views'),
  path.join(__dirname, 'src', 'views'),
  path.join(__dirname, 'src', 'Views')
]);

// Body parser & Static files
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware
app.use(session({
  secret: 'wbuhs_efile_secret_key_2026_saltlake',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 hours
}));

// Global view variables
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.activeNav = '';
  next();
});

// Auth Middlewares
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'SUPER ADMIN') {
    return res.status(403).send('Access Denied: Super Admin Privileges Required.');
  }
  next();
}

// ---------------- ROUTES ----------------

// Home Route
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

// Login Routes
app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('login', { error: null, success: null });
});

app.post('/login', (req, res) => {
  const { login, password } = req.body;
  const user = db.getUserByLogin(login);

  if (!user || !db.verifyPassword(user, password)) {
    return res.render('login', { error: 'Invalid Email/User ID/Handle or Password.', success: null });
  }

  if (user.status !== 'Active') {
    return res.render('login', { error: 'Your officer account is locked or inactive.', success: null });
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    handle: user.handle,
    role: user.role,
    department: user.department,
    designation: user.designation
  };

  db.addAuditLog(user.id, user.name, 'USER_LOGIN', `Logged in via handle/email ${login}`);
  res.redirect('/dashboard');
});

// Logout
app.get('/logout', (req, res) => {
  if (req.session.user) {
    db.addAuditLog(req.session.user.id, req.session.user.name, 'USER_LOGOUT', 'Logged out of session');
  }
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Dashboard
app.get('/dashboard', requireAuth, (req, res) => {
  res.locals.activeNav = 'dashboard';
  const inboxFiles = db.getInboxForUser(req.session.user.id);
  const outboxFiles = db.getOutboxForUser(req.session.user.id);
  const totalFilesCount = db.getFiles().length;

  res.render('dashboard', {
    inboxFiles,
    outboxFiles,
    totalFilesCount
  });
});

// File Search Route
app.get('/search', requireAuth, (req, res) => {
  const query = (req.query.q || '').trim();
  const searchLower = query.toLowerCase();

  const allFiles = db.getFiles();
  const results = allFiles.filter(f => {
    return (
      (f.fileNo && f.fileNo.toLowerCase().includes(searchLower)) ||
      (f.subject && f.subject.toLowerCase().includes(searchLower)) ||
      (f.category && f.category.toLowerCase().includes(searchLower)) ||
      (f.createdByName && f.createdByName.toLowerCase().includes(searchLower)) ||
      (f.currentHolderName && f.currentHolderName.toLowerCase().includes(searchLower)) ||
      (f.priority && f.priority.toLowerCase().includes(searchLower))
    );
  });

  res.render('search_results', { query, results });
});

// Inbox
app.get('/inbox', requireAuth, (req, res) => {
  res.locals.activeNav = 'inbox';
  const files = db.getInboxForUser(req.session.user.id);
  res.render('inbox', { files });
});

// Outbox / Sent Files
app.get('/outbox', requireAuth, (req, res) => {
  res.locals.activeNav = 'outbox';
  const files = db.getOutboxForUser(req.session.user.id);
  res.render('outbox', { files });
});

// Create File
app.get('/create-file', requireAuth, (req, res) => {
  res.locals.activeNav = 'create';
  res.render('create_file');
});

app.post('/create-file', requireAuth, upload.array('attachments', 10), (req, res) => {
  const { subject, category, priority, confidentiality, initialNote } = req.body;
  
  const processedAttachments = (req.files || []).map(f => ({
    name: f.filename,
    originalName: f.originalname,
    path: '/uploads/' + f.filename,
    mimeType: f.mimetype,
    size: (f.size / (1024 * 1024)).toFixed(2) + ' MB'
  }));

  const fileData = {
    subject,
    category,
    priority,
    confidentiality,
    initialNote,
    initialRemarks: 'File created and initiated by ' + req.session.user.name,
    attachments: processedAttachments
  };

  const newFile = db.createFile(fileData, req.session.user);
  db.addAuditLog(req.session.user.id, req.session.user.name, 'CREATE_FILE', `Created file ${newFile.fileNo} - ${newFile.subject}`);
  
  res.redirect('/file/' + newFile.id);
});

// View File Detail (Split Pane View)
app.get('/file/:id', requireAuth, (req, res) => {
  const file = db.getFileById(req.params.id);
  if (!file) return res.status(404).send('File not found.');

  const notings = db.getNotingsForFile(file.id);
  const movements = db.getMovementsForFile(file.id);
  const officers = db.getUsers().filter(u => u.status === 'Active');

  res.render('view_file', {
    file,
    notings,
    movements,
    officers
  });
});

// Dedicated Multiple File Upload Route
app.post('/file/:id/attach', requireAuth, upload.array('attachments', 10), (req, res) => {
  const file = db.getFileById(req.params.id);
  if (!file) return res.status(404).send('File not found.');

  if (file.currentHolderId !== req.session.user.id) {
    return res.status(403).send('Only the officer currently holding the file can attach new documents.');
  }

  const newAttachments = (req.files || []).map(f => ({
    name: f.filename,
    originalName: f.originalname,
    path: '/uploads/' + f.filename,
    mimeType: f.mimetype,
    size: (f.size / (1024 * 1024)).toFixed(2) + ' MB'
  }));

  if (newAttachments.length > 0) {
    db.transferFile(
      file.id,
      req.session.user,
      req.session.user, // Keeps current holder
      'Attached Files',
      `Uploaded ${newAttachments.length} additional file(s)`,
      null,
      newAttachments
    );

    db.addAuditLog(
      req.session.user.id,
      req.session.user.name,
      'ATTACH_FILES',
      `Attached ${newAttachments.length} file(s) to ${file.fileNo}`
    );
  }

  res.redirect('/file/' + file.id);
});

// Process File Action / Append Green Note / Transfer File
app.post('/file/:id/action', requireAuth, upload.array('newAttachments', 10), (req, res) => {
  const file = db.getFileById(req.params.id);
  if (!file) return res.status(404).send('File not found.');

  const { newNote, recipientId, actionType, remarks } = req.body;
  const recipientUser = db.getUserById(recipientId);

  if (!recipientUser) {
    return res.status(400).send('Invalid recipient officer selected.');
  }

  const processedNewAttachments = (req.files || []).map(f => ({
    name: f.filename,
    originalName: f.originalname,
    path: '/uploads/' + f.filename,
    mimeType: f.mimetype,
    size: (f.size / (1024 * 1024)).toFixed(2) + ' MB'
  }));

  const updatedFile = db.transferFile(
    file.id,
    req.session.user,
    recipientUser,
    actionType,
    remarks,
    newNote,
    processedNewAttachments
  );

  db.addAuditLog(
    req.session.user.id,
    req.session.user.name,
    'TRANSFER_FILE',
    `Transferred file ${file.fileNo} to ${recipientUser.name} (${actionType})`
  );

  res.redirect('/file/' + file.id);
});

// Download / Printable Green Sheet PDF Document View
app.get('/file/:id/noting-pdf', requireAuth, (req, res) => {
  const file = db.getFileById(req.params.id);
  if (!file) return res.status(404).send('File not found.');

  const notings = db.getNotingsForFile(file.id);
  res.render('noting_pdf', { file, notings });
});

// Track File Movement Timeline
app.get('/file/:id/tracking', requireAuth, (req, res) => {
  const file = db.getFileById(req.params.id);
  if (!file) return res.status(404).send('File not found.');

  const movements = db.getMovementsForFile(file.id);
  res.render('tracking', { file, movements });
});

// Contacts Directory
app.get('/contacts', requireAuth, (req, res) => {
  res.locals.activeNav = 'contacts';
  const contacts = db.getUsers().filter(u => u.status === 'Active');
  res.render('contacts', { contacts });
});

// Self Change Password
app.get('/change-password', requireAuth, (req, res) => {
  res.render('change_password', { error: null, success: null });
});

app.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.render('change_password', { error: 'New password and confirm password do not match.', success: null });
  }

  const result = db.changePassword(req.session.user.id, currentPassword, newPassword);

  if (!result.success) {
    return res.render('change_password', { error: result.message, success: null });
  }

  db.addAuditLog(req.session.user.id, req.session.user.name, 'CHANGE_PASSWORD', 'Updated account password');
  res.render('change_password', { error: null, success: 'Your password has been changed successfully!' });
});

// ---------------- ADMIN PANEL ROUTES ----------------

// Admin User Control
app.get('/admin/users', requireAuth, requireAdmin, (req, res) => {
  res.locals.activeNav = 'admin_users';
  const users = db.getUsers();
  res.render('admin_users', { users, error: null, success: null });
});

// Admin Create User
app.post('/admin/users/create', requireAuth, requireAdmin, (req, res) => {
  const { name, email, handle, password, role, designation, department, phone } = req.body;
  
  const existing = db.getUserByLogin(email) || db.getUserByLogin(handle);
  if (existing) {
    const users = db.getUsers();
    return res.render('admin_users', { users, error: 'User with this email or handle already exists.', success: null });
  }

  const newUser = db.createUser({
    name,
    email,
    handle,
    password,
    role,
    designation,
    department,
    phone
  });

  db.addAuditLog(req.session.user.id, req.session.user.name, 'ADMIN_CREATE_USER', `Created user ${newUser.name} (${newUser.email})`);
  
  const users = db.getUsers();
  res.render('admin_users', { users, error: null, success: `Officer account for ${newUser.name} created successfully!` });
});

// Admin Edit / Remodify User
app.post('/admin/users/update', requireAuth, requireAdmin, (req, res) => {
  const { id, name, email, handle, role, designation, department, phone, status } = req.body;

  const updated = db.updateUser(id, {
    name,
    email,
    handle,
    role,
    designation,
    department,
    phone,
    status
  });

  db.addAuditLog(req.session.user.id, req.session.user.name, 'ADMIN_UPDATE_USER', `Updated user details for ${name}`);
  
  const users = db.getUsers();
  res.render('admin_users', { users, error: null, success: `Officer details for ${name} updated successfully!` });
});

// Admin Reset Password
app.post('/admin/users/reset-password', requireAuth, requireAdmin, (req, res) => {
  const { id, newPassword } = req.body;

  const updated = db.updateUser(id, { newPassword });
  if (updated) {
    db.addAuditLog(req.session.user.id, req.session.user.name, 'ADMIN_RESET_PASSWORD', `Reset password for user ${updated.name}`);
  }

  const users = db.getUsers();
  res.render('admin_users', { users, error: null, success: `Password for ${updated ? updated.name : 'User'} reset successfully!` });
});

// Admin Audit Logs
app.get('/admin/audit-logs', requireAuth, requireAdmin, (req, res) => {
  res.locals.activeNav = 'audit_logs';
  const logs = db.getAuditLogs();
  res.render('audit_logs', { logs });
});

// Diagnostic Error Handler
app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err.stack || err);
  res.status(500).send(`
    <div style="font-family: sans-serif; padding: 30px; background: #fff3f3; color: #900; border: 1px solid #f99; border-radius: 8px; max-width: 800px; margin: 40px auto;">
      <h2>WBUHS e-Office Server Error Diagnostic</h2>
      <p><strong>Message:</strong> ${err.message}</p>
      <pre style="background: #222; color: #0f0; padding: 15px; border-radius: 4px; overflow-x: auto;">${err.stack}</pre>
    </div>
  `);
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`WBUHS E-File System Server running on port ${PORT}`);
  console.log(`Access Link: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
