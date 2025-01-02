const BASE_URL = "https://www.call2all.co.il/ym/api";

// Utility Functions
function replaceVariables(template, contact) {
  let message = template;
  const variables = {
    name: contact.name,
    var1: contact.var1 || '',
    var2: contact.var2 || '',
    var3: contact.var3 || '',
    var4: contact.var4 || '',
    var5: contact.var5 || ''
  };

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    message = message.replace(regex, value);
  }

  return message;
}

// Local Storage Functions
const storage = {
  setItem: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
  getItem: (key, defaultValue = null) => {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  },
  removeItem: (key) => localStorage.removeItem(key)
};

// API Functions
const api = {
  async login(username, password) {
    const response = await fetch(`${BASE_URL}/Login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (data.responseStatus !== "OK") {
      throw new Error("שם משתמש או סיסמה שגויים");
    }
    return data.token;
  },

  async sendSms(token, phone, message, from, isFlash = false) {
    const response = await fetch(`${BASE_URL}/SendSms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        token, 
        phones: phone, 
        message, 
        from,
        sendFlashMessage: isFlash ? 1 : 0 
      })
    });
    const data = await response.json();
    if (data.responseStatus !== "OK") {
      throw new Error("שליחה נכשלה");
    }
    return data.messageId;
  }
};

// UI Elements
const elements = {
  loginScreen: document.getElementById("login-screen"),
  appScreen: document.getElementById("app-screen"),
  loginError: document.getElementById("login-error"),
  username: document.getElementById("username"),
  password: document.getElementById("password"),
  senderNumber: document.getElementById("sender-number"),
  sections: {
    contacts: document.getElementById("contacts-section"),
    message: document.getElementById("message-section"),
    history: document.getElementById("history-section")
  },
  contactsTable: document.querySelector("#contacts-table tbody"),
  addContactForm: document.getElementById("add-contact-form"),
  newContactForm: document.getElementById("new-contact-form"),
  excelFile: document.getElementById("excel-file"),
  closeFormBtn: document.getElementById("close-form"),
  cancelAddBtn: document.getElementById("cancel-add"),
  messagePreviewBtn: document.getElementById('preview-message'),
  messagePreview: document.querySelector('.message-preview')
};

// Contact Management
class ContactManager {
  constructor() {
    this.contacts = storage.getItem('contacts', []);
  }

  add(contact) {
    contact.id = Date.now().toString();
    this.contacts.push(contact);
    this.save();
    return contact;
  }

  update(id, updatedContact) {
    const index = this.contacts.findIndex(c => c.id === id);
    if (index !== -1) {
      this.contacts[index] = { ...this.contacts[index], ...updatedContact };
      this.save();
    }
  }

  delete(id) {
    const index = this.contacts.findIndex(c => c.id === id);
    if (index !== -1) {
      this.contacts.splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }

  save() {
    storage.setItem('contacts', this.contacts);
  }

  async importFromExcel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet, { 
            header: 1,
            raw: false
          });
          
          let imported = 0;
          const errors = [];
          
          for (let i = 2; i < rows.length; i++) {
            const row = rows[i];
            if (row[0] && row[1]) {
              try {
                this.add({
                  name: row[0].trim(),
                  phone: row[1].toString().trim(),
                  var1: row[2]?.trim() || '',
                  var2: row[3]?.trim() || '',
                  var3: row[4]?.trim() || '',
                  var4: row[5]?.trim() || '',
                  var5: row[6]?.trim() || ''
                });
                imported++;
              } catch (err) {
                errors.push(`שורה ${i + 1}: ${err.message}`);
              }
            }
          }
          
          resolve({ imported, errors });
        } catch (err) {
          reject(new Error('שגיאה בקריאת הקובץ'));
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  exportToExcel() {
    if (!this.contacts.length) {
      alert('אין אנשי קשר לייצוא');
      return;
    }

    // יצירת מערך נתונים לאקסל
    const data = [
      ['שם', 'טלפון', 'משתנה 1', 'משתנה 2', 'משתנה 3', 'משתנה 4', 'משתנה 5'], // כותרות
      ...this.contacts.map(contact => [
        contact.name,
        contact.phone,
        contact.var1 || '',
        contact.var2 || '',
        contact.var3 || '',
        contact.var4 || '',
        contact.var5 || ''
      ])
    ];

    // יצירת גיליון עבודה
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "אנשי קשר");

    // הורדת הקובץ
    XLSX.writeFile(wb, "contacts.xlsx");
  }
}

// Message Preview
const messagePreview = {
  show(message, currentIndex, total) {
    const previewContainer = document.createElement('div');
    previewContainer.className = 'message-preview fade-in';
    previewContainer.innerHTML = `
      <div class="preview-header">
        <h4>תצוגה מקדימה</h4>
        <button class="btn-close" onclick="this.closest('.message-preview').remove()">×</button>
      </div>
      <div class="preview-navigation">
        <button class="btn btn-secondary" onclick="messageManager.previewMessage(-1)">
          <i class="ri-arrow-right-line"></i>
          הקודם
        </button>
        <span>מציג ${currentIndex + 1} מתוך ${total}</span>
        <button class="btn btn-secondary" onclick="messageManager.previewMessage(1)">
          הבא
          <i class="ri-arrow-left-line"></i>
        </button>
      </div>
      <div class="preview-content">${message}</div>
    `;
    
    // מחיקת תצוגה מקדימה קודמת אם קיימת
    const oldPreview = document.querySelector('.message-preview');
    if (oldPreview) oldPreview.remove();
    
    // הוספת התצוגה החדשה
    document.querySelector('.message-form').appendChild(previewContainer);
  }
};

// Message Management
const messageManager = {
  currentPreviewIndex: 0,

  previewMessage(direction = 0) {
    const contacts = contactManager.contacts;
    if (!contacts.length) {
      alert('אין אנשי קשר ברשימת התפוצה');
      return;
    }

    this.currentPreviewIndex += direction;
    if (this.currentPreviewIndex >= contacts.length) this.currentPreviewIndex = 0;
    if (this.currentPreviewIndex < 0) this.currentPreviewIndex = contacts.length - 1;

    const template = document.getElementById('message-template').value;
    const contact = contacts[this.currentPreviewIndex];
    const finalMessage = replaceVariables(template, contact);
    
    messagePreview.show(finalMessage, this.currentPreviewIndex, contacts.length);
  },

  async sendToAll() {
    const template = document.getElementById('message-template').value;
    const token = storage.getItem('token');
    const senderNumber = storage.getItem('senderNumber');
    const isFlashMessage = document.getElementById('flash-message').checked;
    
    if (!token) {
      alert('נא להתחבר מחדש');
      return;
    }

    if (!contactManager.contacts.length) {
      alert('אין אנשי קשר ברשימת התפוצה');
      return;
    }

    if (!template.trim()) {
      alert('נא להזין תוכן הודעה');
      return;
    }

    const progress = document.createElement('div');
    progress.className = 'progress-container fade-in';
    progress.innerHTML = `
      <div class="progress-status">
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
        <p id="progress-status" class="text-center mt-2"></p>
      </div>
    `;
    document.querySelector('.message-form').appendChild(progress);

    const progressFill = progress.querySelector('.progress-fill');
    const progressStatus = progress.querySelector('#progress-status');
    
    const total = contactManager.contacts.length;
    let success = 0;
    let failed = 0;

    for (let i = 0; i < total; i++) {
      const contact = contactManager.contacts[i];
      const message = replaceVariables(template, contact);
      
      try {
        const messageId = await api.sendSms(token, contact.phone, message, senderNumber, isFlashMessage);
        success++;
        this.saveToHistory({
          timestamp: new Date().toISOString(),
          recipient: contact.phone,
          name: contact.name,
          message: message,
          status: 'נשלח בהצלחה',
          messageId
        });
      } catch (err) {
        failed++;
        this.saveToHistory({
          timestamp: new Date().toISOString(),
          recipient: contact.phone,
          name: contact.name,
          message: message,
          status: 'נכשל',
          error: err.message
        });
      }

      const percent = ((i + 1) / total) * 100;
      progressFill.style.width = `${percent}%`;
      progressStatus.textContent = `נשלחו ${i + 1} מתוך ${total} (${success} הצליחו, ${failed} נכשלו)`;
    }

    // הסרת סרגל ההתקדמות אחרי 3 שניות
    setTimeout(() => progress.remove(), 3000);
  },

  saveToHistory(item) {
    const history = storage.getItem('history', []);
    history.unshift(item);
    storage.setItem('history', history);
  }
};

// History Management
const historyManager = {
  getFilteredHistory() {
    const history = storage.getItem('history', []);
    const dateFrom = document.getElementById('date-from').value;
    const dateTo = document.getElementById('date-to').value;
    
    if (!dateFrom && !dateTo) return history;
    
    return history.filter(item => {
      const itemDate = new Date(item.timestamp).toISOString().split('T')[0];
      if (dateFrom && itemDate < dateFrom) return false;
      if (dateTo && itemDate > dateTo) return false;
      return true;
    });
  },

  exportToCsv() {
    const history = this.getFilteredHistory();
    if (!history.length) {
      alert('אין נתונים לייצוא');
      return;
    }

    const headers = ['תאריך/שעה', 'נמען', 'שם', 'תוכן הודעה', 'סטטוס'];
    const rows = history.map(item => [
      item.timestamp,
      item.recipient,
      item.name,
      item.message,
      item.status
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'history.csv';
    link.click();
  }
};

// UI Management
const ui = {
  showSection(sectionName) {
    Object.values(elements.sections).forEach(section => 
      section.classList.add('hidden')
    );
    elements.sections[sectionName]?.classList.remove('hidden');
  },

  renderContacts(contacts) {
    elements.contactsTable.innerHTML = '';
    contacts.forEach(contact => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${contact.name}</td>
        <td>${contact.phone}</td>
        <td>${contact.var1 || ''}</td>
        <td>${contact.var2 || ''}</td>
        <td>${contact.var3 || ''}</td>
        <td>${contact.var4 || ''}</td>
        <td>${contact.var5 || ''}</td>
        <td class="action-buttons">
          <button class="edit-contact" data-id="${contact.id}">
            <i class="ri-edit-line"></i>
            ערוך
          </button>
          <button class="delete-contact" data-id="${contact.id}">
            <i class="ri-delete-bin-line"></i>
            מחק
          </button>
        </td>
      `;
      elements.contactsTable.appendChild(tr);
    });
  },

  renderHistory() {
    const history = historyManager.getFilteredHistory();
    const tbody = document.querySelector('#history-table tbody');
    tbody.innerHTML = '';
    
    history.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(item.timestamp).toLocaleString()}</td>
        <td>${item.recipient}</td>
        <td>${item.name}</td>
        <td>${item.message}</td>
        <td>${item.status}</td>
      `;
      tbody.appendChild(tr);
    });
  }
};

// Form Functions
function closeContactForm() {
  elements.addContactForm.classList.add('hidden');
  elements.newContactForm.reset();
  delete elements.newContactForm.dataset.editId;
}

// Initialize
const contactManager = new ContactManager();

function initializeApp() {
  const token = storage.getItem('token');
  const defaultSenderNumber = storage.getItem('defaultSenderNumber');
  
  if (token && defaultSenderNumber) {
    // הצגת המסך הראשי
    elements.loginScreen.classList.add('hidden');
    elements.appScreen.classList.remove('hidden');
    
    // הגדרת מספר השולח בשדה
    document.getElementById('sender-id').value = defaultSenderNumber;
    
    // טעינת הנתונים הראשונית
    ui.renderContacts(contactManager.contacts);
    ui.showSection('contacts');
  } else {
    // אם אין טוקן תקף, מציג את מסך ההתחברות
    elements.loginScreen.classList.remove('hidden');
    elements.appScreen.classList.add('hidden');
    
    // ניקוי שדות הטופס
    elements.username.value = '';
    elements.password.value = '';
  }
}

// Message Cost Calculator
const messageCost = {
  calculateUnits(text, variables = []) {
    // חישוב אורך ההודעה כולל משתנים
    const estimatedLength = variables.reduce((total, variable) => {
      return total + (variable.length || 0);
    }, text.length);
    
    // חישוב מספר יחידות SMS
    return Math.ceil(estimatedLength / 70);
  },

  updateCostSummary() {
    const text = document.getElementById('message-template').value;
    const recipientsCount = contactManager.contacts.length;
    const messageLength = text.length;
    
    // חישוב אורך משוער כולל משתנים
    const variables = contactManager.contacts[0] ? [
      contactManager.contacts[0].name.length,
      contactManager.contacts[0].var1?.length || 0,
      contactManager.contacts[0].var2?.length || 0,
      contactManager.contacts[0].var3?.length || 0,
      contactManager.contacts[0].var4?.length || 0,
      contactManager.contacts[0].var5?.length || 0
    ] : [];
    
    const smsUnits = this.calculateUnits(text, variables);
    const totalUnits = smsUnits * recipientsCount;
    const regularUnits = totalUnits * 0.1;
    
    document.getElementById('message-length').textContent = messageLength;
    document.getElementById('recipients-count').textContent = recipientsCount;
    document.getElementById('estimated-cost').textContent = totalUnits;
    document.getElementById('regular-units').textContent = regularUnits.toFixed(1);
    
    // עדכון מונה תווים
    document.getElementById('char-count').textContent = messageLength;
  }
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // שמירת מספר השולח המקורי
  let defaultSenderNumber = '';

  // Login Handler
  document.getElementById('btn-login').addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      const token = await api.login(
        elements.username.value,
        elements.password.value
      );
      
      // שמירת הטוקן ומספר השולח המקורי
      storage.setItem('token', token);
      defaultSenderNumber = elements.username.value; // או לקבל מהשרת
      storage.setItem('defaultSenderNumber', defaultSenderNumber);
      
      // הצגת המסך הראשי
      elements.loginScreen.classList.add('hidden');
      elements.appScreen.classList.remove('hidden');
      
      // הגדרת מספר השולח בשדה
      document.getElementById('sender-id').value = defaultSenderNumber;
      
      // טעינת הנתונים הראשונית
      ui.renderContacts(contactManager.contacts);
      ui.showSection('contacts');
    } catch (err) {
      elements.loginError.textContent = err.message;
    }
  });

  // Sender ID Handler
  document.getElementById('sender-id').addEventListener('change', (e) => {
    storage.setItem('senderNumber', e.target.value);
  });

  document.getElementById('logout').addEventListener('click', () => {
    if (confirm('האם אתה בטוח שברצונך להתנתק?')) {
      // מחיקת נתוני ההתחברות
      storage.removeItem('token');
      storage.removeItem('defaultSenderNumber');
      
      // הצגת מסך ההתחברות
      elements.loginScreen.classList.remove('hidden');
      elements.appScreen.classList.add('hidden');
      
      // ניקוי שדות הטופס
      elements.username.value = '';
      elements.password.value = '';
    }
  });

  // Navigation Handlers
  document.getElementById('goto-contacts').addEventListener('click', () => {
    ui.showSection('contacts');
    ui.renderContacts(contactManager.contacts);
  });

  document.getElementById('goto-message').addEventListener('click', () => {
    ui.showSection('message');
  });

  document.getElementById('goto-history').addEventListener('click', () => {
    ui.showSection('history');
    ui.renderHistory();
  });

  // Contact Form Handlers
  document.getElementById('show-add-form').addEventListener('click', () => {
    elements.addContactForm.classList.remove('hidden');
  });

  elements.closeFormBtn?.addEventListener('click', closeContactForm);
  elements.cancelAddBtn?.addEventListener('click', closeContactForm);

  elements.newContactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const contact = {
      name: formData.get('name'),
      phone: formData.get('phone'),
      var1: formData.get('var1'),
      var2: formData.get('var2'),
      var3: formData.get('var3'),
      var4: formData.get('var4'),
      var5: formData.get('var5')
    };

    const editId = e.target.dataset.editId;
    if (editId) {
      contactManager.update(editId, contact);
      delete e.target.dataset.editId;
    } else {
      contactManager.add(contact);
    }

    ui.renderContacts(contactManager.contacts);
    closeContactForm();
  });

  // Excel Import Handlers
  document.getElementById('excel-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const result = await contactManager.importFromExcel(file);
      const message = `
        יובאו ${result.imported} אנשי קשר בהצלחה
        ${result.errors.length ? '\nשגיאות:\n' + result.errors.join('\n') : ''}
        
        האם ברצונך לשמור את השינויים?
      `;
      
      if (confirm(message)) {
        ui.renderContacts(contactManager.contacts);
        e.target.value = '';
      } else {
        contactManager.contacts = storage.getItem('contacts', []);
        ui.renderContacts(contactManager.contacts);
      }
    } catch (err) {
      alert(err.message);
    }
  });

  // Message Handlers
  elements.messagePreviewBtn?.addEventListener('click', () => {
    messageManager.previewMessage();
  });

  document.getElementById('send-all').addEventListener('click', () => {
    messageManager.sendToAll();
  });

  // History Handlers
  document.getElementById('refresh-history').addEventListener('click', () => {
    ui.renderHistory();
  });

  document.getElementById('export-csv').addEventListener('click', () => {
    historyManager.exportToCsv();
  });

  document.getElementById('filter-dates').addEventListener('click', () => {
    ui.renderHistory();
  });

  // Table Action Handlers
  document.getElementById('contacts-table').addEventListener('click', (e) => {
    const button = e.target.closest('.edit-contact, .delete-contact');
    if (!button) return;

    const id = button.dataset.id;
    if (!id) return;

    if (button.classList.contains('edit-contact')) {
      const contact = contactManager.contacts.find(c => c.id === id);
      if (!contact) return;

      const form = elements.newContactForm;
      form.querySelector('[name="name"]').value = contact.name;
      form.querySelector('[name="phone"]').value = contact.phone;
      form.querySelector('[name="var1"]').value = contact.var1 || '';
      form.querySelector('[name="var2"]').value = contact.var2 || '';
      form.querySelector('[name="var3"]').value = contact.var3 || '';
      form.querySelector('[name="var4"]').value = contact.var4 || '';
      form.querySelector('[name="var5"]').value = contact.var5 || '';
      
      form.dataset.editId = id;
      elements.addContactForm.classList.remove('hidden');
    }
    
    if (button.classList.contains('delete-contact')) {
      if (confirm('האם אתה בטוח שברצונך למחוק איש קשר זה?')) {
        contactManager.delete(id);
        ui.renderContacts(contactManager.contacts);
      }
    }
  });

  // Variable Buttons
  document.querySelectorAll('.btn-variable').forEach(btn => {
    btn.addEventListener('click', () => {
      const textarea = document.getElementById('message-template');
      const variable = btn.dataset.variable;
      const cursorPos = textarea.selectionStart;
      const textBefore = textarea.value.substring(0, cursorPos);
      const textAfter = textarea.value.substring(cursorPos);
      
      textarea.value = `${textBefore}{{${variable}}}${textAfter}`;
      textarea.focus();
      messageCost.updateCostSummary();
    });
  });

  // Message Template Changes
  document.getElementById('message-template').addEventListener('input', () => {
    messageCost.updateCostSummary();
  });

  // Initialize App
  initializeApp();

  document.getElementById('export-contacts').addEventListener('click', () => {
    contactManager.exportToExcel();
  });
}); 