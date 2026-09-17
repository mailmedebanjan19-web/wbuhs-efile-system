const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data', 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Ensure directories exist
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Initial DB Structure
const defaultData = {
  users: [],
  files: [],
  notings: [],
  movements: [],
  auditLogs: []
};

// Seed default users if empty
function seedDefaultUsers(dbData) {
  if (dbData.users && dbData.users.length > 0) return dbData;

  const initialUsers = [
    {
      id: 'USR-PROG4',
      name: 'Programmer 4',
      email: 'programmer_4@wbuhs.ac.in',
      handle: 'programmer_4',
      username: 'programmer_4',
      password: 'debanjan',
      role: 'SUPER ADMIN',
      department: 'IT & Systems Cell',
      designation: 'Programmer Grade IV',
      phone: '+91 33 2358 9396 Ext 104',
      extension: '104',
      status: 'Active'
    },
    {
      id: 'USR-VC',
      name: 'Prof. (Dr.) Mukul Bhattacharyya',
      email: 'vc@wbuhs.ac.in',
      handle: 'vc',
      username: 'vc',
      password: 'admin',
      role: 'SUPER ADMIN',
      department: 'Vice Chancellor Secretariat',
      designation: 'Hon\'ble Vice Chancellor',
      phone: '+91 33 2358 9396 Ext 101',
      extension: '101',
      status: 'Active'
    },
    {
      id: 'USR-REGISTRAR',
      name: 'Prof. (Dr.) Indranath Kundu',
      email: 'registrar@wbuhs.ac.in',
      handle: 'registrar',
      username: 'registrar',
      password: 'admin',
      role: 'Registrar',
      department: 'Registrar Secretariat',
      designation: 'Registrar',
      phone: '+91 33 2358 9396 Ext 102',
      extension: '102',
      status: 'Active'
    },
    {
      id: 'USR-FO',
      name: 'Shri Lalu Das',
      email: 'fo@wbuhs.ac.in',
      handle: 'fo',
      username: 'fo',
      password: 'user123',
      role: 'Finance Officer',
      department: 'Finance & Accounts Department',
      designation: 'Finance Officer',
      phone: '+91 33 2358 9396 Ext 103',
      extension: '103',
      status: 'Active'
    },
    {
      id: 'USR-COE',
      name: 'Prof. Dr. Anindya Dasgupta',
      email: 'coe@wbuhs.ac.in',
      handle: 'coe',
      username: 'coe',
      password: 'user123',
      role: 'Controller of Exams',
      department: 'Examination Section',
      designation: 'Controller of Examinations',
      phone: '+91 33 2358 9396 Ext 105',
      extension: '105',
      status: 'Active'
    }
  ];

  initialUsers.forEach(u => {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(u.password, salt);
    dbData.users.push({
      id: u.id,
      name: u.name,
      email: u.email,
      handle: u.handle,
      username: u.username,
      passwordHash,
      role: u.role,
      department: u.department,
      designation: u.designation,
      phone: u.phone,
      extension: u.extension,
      status: u.status,
      createdAt: new Date().toISOString()
    });
  });

  return dbData;
}

// Read Database
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const seeded = seedDefaultUsers({ ...defaultData });
      writeDB(seeded);
      return seeded;
    }
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.users || parsed.users.length === 0) {
      const seeded = seedDefaultUsers(parsed);
      writeDB(seeded);
      return seeded;
    }
    return parsed;
  } catch (err) {
    console.error('Error reading database:', err);
    return defaultData;
  }
}

// Write Database atomically
function writeDB(data) {
  try {
    const tempPath = `${DB_PATH}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, DB_PATH);
  } catch (err) {
    console.error('Error writing database:', err);
  }
}

// User Helpers
function getUsers() {
  const db = readDB();
  return db.users || [];
}

function getUserById(id) {
  const users = getUsers();
  return users.find(u => u.id === id);
}

function getUserByLogin(handleOrEmail) {
  const users = getUsers();
  const search = (handleOrEmail || '').toLowerCase().trim();
  return users.find(u => 
    (u.email && u.email.toLowerCase() === search) || 
    (u.handle && u.handle.toLowerCase() === search) ||
    (u.username && u.username.toLowerCase() === search)
  );
}

function createUser(userData) {
  const db = readDB();
  const id = 'USR-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(userData.password || 'user123', salt);

  const newUser = {
    id,
    name: userData.name,
    email: userData.email,
    handle: userData.handle,
    username: userData.handle || userData.email.split('@')[0],
    passwordHash,
    role: userData.role || 'Officer',
    department: userData.department || 'General Administration',
    designation: userData.designation || 'Officer',
    phone: userData.phone || '+91 33 2358 9396',
    extension: userData.extension || '101',
    status: 'Active',
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  writeDB(db);
  return newUser;
}

function updateUser(id, updateData) {
  const db = readDB();
  const index = db.users.findIndex(u => u.id === id);
  if (index === -1) return null;

  const user = db.users[index];
  if (updateData.name) user.name = updateData.name;
  if (updateData.email) user.email = updateData.email;
  if (updateData.handle) user.handle = updateData.handle;
  if (updateData.role) user.role = updateData.role;
  if (updateData.department) user.department = updateData.department;
  if (updateData.designation) user.designation = updateData.designation;
  if (updateData.phone) user.phone = updateData.phone;
  if (updateData.extension) user.extension = updateData.extension;
  if (updateData.status) user.status = updateData.status;

  if (updateData.newPassword) {
    const salt = bcrypt.genSaltSync(10);
    user.passwordHash = bcrypt.hashSync(updateData.newPassword, salt);
  }

  db.users[index] = user;
  writeDB(db);
  return user;
}

function changePassword(userId, currentPassword, newPassword) {
  const db = readDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) return { success: false, message: 'User not found.' };

  const isMatch = bcrypt.compareSync(currentPassword, user.passwordHash);
  if (!isMatch) return { success: false, message: 'Incorrect current password.' };

  const salt = bcrypt.genSaltSync(10);
  user.passwordHash = bcrypt.hashSync(newPassword, salt);
  writeDB(db);
  return { success: true, message: 'Password updated successfully.' };
}

function verifyPassword(user, plainPassword) {
  return bcrypt.compareSync(plainPassword, user.passwordHash);
}

// File Helpers
function getFiles() {
  const db = readDB();
  return db.files || [];
}

function getFileById(id) {
  const files = getFiles();
  return files.find(f => f.id === id);
}

function createFile(fileData, creatorUser) {
  const db = readDB();
  const count = (db.files || []).length + 1;
  const fileNo = `WBUHS/${creatorUser.department ? creatorUser.department.substring(0, 3).toUpperCase() : 'GEN'}/${new Date().getFullYear()}/${String(count).padStart(3, '0')}`;
  const id = 'FILE-' + Date.now();

  const newFile = {
    id,
    fileNo,
    subject: fileData.subject,
    category: fileData.category || 'General',
    priority: fileData.priority || 'Normal',
    confidentiality: fileData.confidentiality || 'Standard',
    status: 'Pending',
    currentHolderId: creatorUser.id,
    currentHolderName: creatorUser.name,
    currentHolderDesignation: creatorUser.designation,
    createdByUserId: creatorUser.id,
    createdByName: creatorUser.name,
    createdAt: new Date().toISOString(),
    attachments: fileData.attachments || []
  };

  db.files.push(newFile);

  db.movements.push({
    id: 'MOV-' + Date.now() + '-1',
    fileId: id,
    fromUserId: creatorUser.id,
    fromUserName: creatorUser.name,
    fromUserDesignation: creatorUser.designation,
    toUserId: creatorUser.id,
    toUserName: creatorUser.name,
    toUserDesignation: creatorUser.designation,
    actionTaken: 'File Created & Initiated',
    remarks: fileData.initialRemarks || 'File initiated in system.',
    timestamp: new Date().toISOString()
  });

  if (fileData.initialNote) {
    db.notings.push({
      id: 'NOTE-' + Date.now() + '-1',
      fileId: id,
      noteNo: 1,
      authorId: creatorUser.id,
      authorName: creatorUser.name,
      authorDesignation: creatorUser.designation,
      authorDepartment: creatorUser.department,
      content: fileData.initialNote,
      timestamp: new Date().toISOString()
    });
  }

  writeDB(db);
  return newFile;
}

function transferFile(fileId, senderUser, recipientUser, actionType, remarks, newNoteText, newAttachments) {
  const db = readDB();
  const fileIndex = db.files.findIndex(f => f.id === fileId);
  if (fileIndex === -1) return null;

  const file = db.files[fileIndex];
  file.currentHolderId = recipientUser.id;
  file.currentHolderName = recipientUser.name;
  file.currentHolderDesignation = recipientUser.designation;
  file.status = actionType === 'Returned' ? 'Returned' : (actionType === 'Approved' ? 'Approved' : 'Forwarded');
  file.updatedAt = new Date().toISOString();

  if (newAttachments && newAttachments.length > 0) {
    file.attachments = file.attachments.concat(newAttachments);
  }

  db.files[fileIndex] = file;

  const movement = {
    id: 'MOV-' + Date.now(),
    fileId: file.id,
    fromUserId: senderUser.id,
    fromUserName: senderUser.name,
    fromUserDesignation: senderUser.designation,
    toUserId: recipientUser.id,
    toUserName: recipientUser.name,
    toUserDesignation: recipientUser.designation,
    actionTaken: actionType,
    remarks: remarks || '',
    timestamp: new Date().toISOString()
  };
  db.movements.push(movement);

  if (newNoteText && newNoteText.trim()) {
    const fileNotings = db.notings.filter(n => n.fileId === file.id);
    const noteNo = fileNotings.length + 1;
    db.notings.push({
      id: 'NOTE-' + Date.now(),
      fileId: file.id,
      noteNo,
      authorId: senderUser.id,
      authorName: senderUser.name,
      authorDesignation: senderUser.designation,
      authorDepartment: senderUser.department,
      content: newNoteText,
      timestamp: new Date().toISOString()
    });
  }

  writeDB(db);
  return file;
}

function addGreenNote(fileId, authorUser, noteContent) {
  const db = readDB();
  const fileNotings = db.notings.filter(n => n.fileId === fileId);
  const noteNo = fileNotings.length + 1;

  const newNote = {
    id: 'NOTE-' + Date.now(),
    fileId,
    noteNo,
    authorId: authorUser.id,
    authorName: authorUser.name,
    authorDesignation: authorUser.designation,
    authorDepartment: authorUser.department,
    content: noteContent,
    timestamp: new Date().toISOString()
  };

  db.notings.push(newNote);
  writeDB(db);
  return newNote;
}

function getNotingsForFile(fileId) {
  const db = readDB();
  return (db.notings || [])
    .filter(n => n.fileId === fileId)
    .sort((a, b) => a.noteNo - b.noteNo);
}

function getMovementsForFile(fileId) {
  const db = readDB();
  return (db.movements || [])
    .filter(m => m.fileId === fileId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function getInboxForUser(userId) {
  const files = getFiles();
  return files.filter(f => f.currentHolderId === userId);
}

function getOutboxForUser(userId) {
  const db = readDB();
  const movements = db.movements || [];
  const fileIdsSent = [...new Set(movements.filter(m => m.fromUserId === userId && m.toUserId !== userId).map(m => m.fileId))];
  return db.files.filter(f => fileIdsSent.includes(f.id));
}

function addAuditLog(userId, userName, action, details) {
  const db = readDB();
  db.auditLogs.push({
    id: 'LOG-' + Date.now(),
    userId,
    userName,
    action,
    details,
    timestamp: new Date().toISOString()
  });
  writeDB(db);
}

function getAuditLogs() {
  const db = readDB();
  return (db.auditLogs || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

module.exports = {
  readDB,
  writeDB,
  getUsers,
  getUserById,
  getUserByLogin,
  createUser,
  updateUser,
  changePassword,
  verifyPassword,
  getFiles,
  getFileById,
  createFile,
  transferFile,
  addGreenNote,
  getNotingsForFile,
  getMovementsForFile,
  getInboxForUser,
  getOutboxForUser,
  addAuditLog,
  getAuditLogs
};
