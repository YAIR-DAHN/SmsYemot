const BASE_URL = "https://www.call2all.co.il/ym/api";

// Utility Functions
function formatPhoneNumber(phone) {
  // מסיר את ה + אם קיים
  phone = phone.replace(/^\+/, '');
  
  // אם המספר מתחיל ב-972, נחליף ל-0
  if (phone.startsWith('972')) {
    return '0' + phone.substring(3);
  }
  return phone;
}

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
    
    // בדיקת תוקף הטוקן
    if (data.responseStatus === "EXCEPTION" && 
        data.message?.includes("session token is invalid")) {
      throw new Error("TOKEN_EXPIRED");
    }
    
    if (data.responseStatus !== "OK") {
      throw new Error("שליחה נכשלה");
    }
    return data.messageId;
  },

  async getSession(token) {
    const response = await fetch(`${BASE_URL}/GetSession`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    const data = await response.json();
    
    // בדיקת תוקף הטוקן
    if (data.responseStatus === "EXCEPTION" && 
        data.message?.includes("session token is invalid")) {
      throw new Error("TOKEN_EXPIRED");
    }
    
    if (data.responseStatus !== "OK") {
      throw new Error("שגיאה בטעינת נתוני המערכת");
    }
    return data;
  },

  async getTemplates(token) {
    const response = await fetch(`${BASE_URL}/GetTemplates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    const data = await response.json();
    
    if (data.responseStatus === "EXCEPTION" && 
        data.message?.includes("session token is invalid")) {
      throw new Error("TOKEN_EXPIRED");
    }
    
    if (data.responseStatus !== "OK") {
      throw new Error("שגיאה בטעינת רשימות התפוצה");
    }
    return data.templates;
  },

  async getTemplateEntries(token, templateId) {
    const response = await fetch(`${BASE_URL}/GetTemplateEntries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, templateId })
    });
    const data = await response.json();
    
    if (data.responseStatus === "EXCEPTION" && 
        data.message?.includes("session token is invalid")) {
      throw new Error("TOKEN_EXPIRED");
    }
    
    if (data.responseStatus !== "OK") {
      throw new Error("שגיאה בטעינת אנשי הקשר");
    }
    return data.entries;
  },

  async getApprovedCallerIDs(token) {
    const response = await fetch(`${BASE_URL}/GetApprovedCallerIDs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    const data = await response.json();
    
    if (data.responseStatus === "EXCEPTION" && 
        data.message?.includes("session token is invalid")) {
      throw new Error("TOKEN_EXPIRED");
    }
    
    if (data.responseStatus !== "OK") {
      throw new Error("שגיאה בטעינת זיהויי שולח מאושרים");
    }
    return data;
  },

  async sendTTS(token, params) {
    const response = await fetch(`${BASE_URL}/SendTTS`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        ...params
      })
    });
    const data = await response.json();
    
    if (data.responseStatus === "EXCEPTION" && 
        data.message?.includes("session token is invalid")) {
      throw new Error("TOKEN_EXPIRED");
    }
    
    if (data.responseStatus !== "OK") {
      throw new Error(data.message || "שליחה נכשלה");
    }
    return data;
  },

  async getSmsIncomingLog(token, limit, startDate = null, endDate = null) {
    const params = { token, limit };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const response = await fetch(`${BASE_URL}/GetSmsIncomingLog`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
    
    const data = await response.json();
    
    if (data.responseStatus === "EXCEPTION" && 
        data.message?.includes("session token is invalid")) {
      throw new Error("TOKEN_EXPIRED");
    }
    
    if (data.responseStatus !== "OK") {
      throw new Error("שגיאה בטעינת הודעות נכנסות");
    }
    
    return data.rows;
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
        <button class="btn-close" onclick="messagePreview.close()">×</button>
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
    this.close();
    
    // הוספת התצוגה החדשה
    document.querySelector('.message-form').appendChild(previewContainer);
  },

  close() {
    const oldPreview = document.querySelector('.message-preview');
    if (oldPreview) {
      oldPreview.classList.add('fade-out');
      setTimeout(() => oldPreview.remove(), 300);
    }
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
    const campaignType = document.querySelector('input[name="campaign-type"]:checked').value;
    
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

    try {
      if (campaignType === 'sms') {
        await this.sendSMSCampaign(token, template, senderNumber);
      } else {
        await this.sendVoiceCampaign(token, template, senderNumber);
      }
      
      await systemManager.refresh();
    } catch (err) {
      if (err.message === "TOKEN_EXPIRED") {
        handleLogout(true);
      } else {
        alert(err.message);
      }
    }

    // הסרת סרגל ההתקדמות אחרי 3 שניות
    setTimeout(() => progress.remove(), 3000);
  },

  async sendSMSCampaign(token, template, senderNumber) {
    const isFlash = document.getElementById('flash-message').checked;
    let successCount = 0;
    let failedCount = 0;
    const errors = [];
    
    // שליחה לכל איש קשר בנפרד
    for (const contact of contactManager.contacts) {
        try {
            // החלפת המשתנים בהודעה
            const finalMessage = replaceVariables(template, contact);
            
            // שליחת ההודעה
            await api.sendSms(token, contact.phone, finalMessage, senderNumber, isFlash);
            successCount++;
            
        } catch (err) {
            failedCount++;
            errors.push({
                contact: contact,
                error: err.message
            });
        }
    }
    
    // שמירה בהיסטוריה
    this.saveToHistory({
        timestamp: new Date().toISOString(),
        type: 'sms',
        recipients: contactManager.contacts.length,
        message: template,
        status: 'נשלח בהצלחה',
        successCount,
        failedCount
    });

    // הצגת סיכום השליחה
    this.showSendingSummary({
        total: contactManager.contacts.length,
        success: successCount,
        failed: failedCount,
        errors: errors,
        isVoiceCampaign: false
    });
  },

  async sendVoiceCampaign(token, template, senderNumber) {
    const voiceType = document.getElementById('voice-type').value;
    const voiceSpeed = document.getElementById('voice-speed').value;
    const repeatTimes = document.getElementById('repeat-times').value;
    
    let successCount = 0;
    let failedCount = 0;
    const errors = [];
    
    // שליחה לכל איש קשר בנפרד
    for (const contact of contactManager.contacts) {
        try {
            // החלפת המשתנים בהודעה
            const finalMessage = replaceVariables(template, contact);
            
            const params = {
                callerId: senderNumber,
                ttsMessage: finalMessage,
                phones: contact.phone,
                ttsVoice: voiceType,
                ttsRate: parseInt(voiceSpeed),
                repeatFile: parseInt(repeatTimes),
                SendMail: 1
            };

            await api.sendTTS(token, params);
            successCount++;
            
        } catch (err) {
            failedCount++;
            errors.push({
                contact: contact,
                error: err.message
            });
        }
    }
    
    // שמירה בהיסטוריה
    this.saveToHistory({
        timestamp: new Date().toISOString(),
        type: 'voice',
        recipients: contactManager.contacts.length,
        message: template,
        status: 'נשלח בהצלחה',
        successCount,
        failedCount
    });

    // הצגת סיכום השליחה
    this.showSendingSummary({
        total: contactManager.contacts.length,
        success: successCount,
        failed: failedCount,
        errors: errors,
        isVoiceCampaign: true
    });
  },

  saveToHistory(item) {
    const history = storage.getItem('history', []);
    history.unshift(item);
    storage.setItem('history', history);
  },

  async sendMessage(contacts, messageTemplate, isVoiceCampaign = false) {
    const token = storage.getItem('token');
    const senderId = document.getElementById('sender-id').value;
    const isFlash = document.getElementById('flash-message').checked;
    
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (const contact of contacts) {
      try {
        // החלפת המשתנים בהודעה
        let finalMessage = messageTemplate;
        finalMessage = finalMessage.replace(/\{שם\}/g, contact.name || '');
        for (let i = 1; i <= 5; i++) {
          const varValue = contact[`var${i}`] || '';
          finalMessage = finalMessage.replace(new RegExp(`\\{משתנה${i}\\}`, 'g'), varValue);
        }

        if (isVoiceCampaign) {
          const voiceSettings = {
            voice: document.getElementById('voice-type').value,
            speed: document.getElementById('voice-speed').value,
            repeat: document.getElementById('repeat-times').value
          };

          await api.sendTTS(token, {
            dest: contact.phone,
            message: finalMessage,
            ...voiceSettings
          });
        } else {
          await api.sendSMS(token, {
            dest: contact.phone,
            message: finalMessage,
            sender: senderId,
            flash: isFlash ? 1 : 0
          });
        }

        successCount++;
        
        // הוספה להיסטוריה
        historyManager.addToHistory({
          timestamp: new Date(),
          type: isVoiceCampaign ? 'voice' : 'sms',
          recipient: contact.phone,
          name: contact.name,
          message: finalMessage,
          status: 'נשלח בהצלחה'
        });

      } catch (err) {
        failCount++;
        errors.push({ contact, error: err.message });
        
        historyManager.addToHistory({
          timestamp: new Date(),
          type: isVoiceCampaign ? 'voice' : 'sms',
          recipient: contact.phone,
          name: contact.name,
          message: messageTemplate,
          status: 'שליחה נכשלה'
        });
      }
    }

    // הצגת סיכום השליחה
    this.showSendingSummary({
      total: contacts.length,
      success: successCount,
      failed: failCount,
      errors,
      isVoiceCampaign
    });
  },

  showSendingSummary({ total, success, failed, errors, isVoiceCampaign }) {
    const modalHtml = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>סיכום שליחה</h3>
          <button type="button" class="btn-close" id="close-summary-modal">×</button>
        </div>
        <div class="modal-body">
          <div class="summary-stats">
            <div class="stat-item">
              <i class="ri-${isVoiceCampaign ? 'phone' : 'message-2'}-line"></i>
              <div class="stat-details">
                <span class="stat-label">סה"כ נשלחו:</span>
                <span class="stat-value">${total}</span>
              </div>
            </div>
            <div class="stat-item success">
              <i class="ri-check-double-line"></i>
              <div class="stat-details">
                <span class="stat-label">נשלחו בהצלחה:</span>
                <span class="stat-value">${success}</span>
              </div>
            </div>
            ${failed > 0 ? `
              <div class="stat-item error">
                <i class="ri-error-warning-line"></i>
                <div class="stat-details">
                  <span class="stat-label">נכשלו:</span>
                  <span class="stat-value">${failed}</span>
                </div>
              </div>
            ` : ''}
          </div>
          
          ${failed > 0 ? `
            <div class="errors-list">
              <h4>פירוט שגיאות:</h4>
              <ul>
                ${errors.map(err => `
                  <li>
                    <strong>${err.contact.name} (${err.contact.phone}):</strong>
                    ${err.error}
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = modalHtml;
    document.body.appendChild(modal);

    // הצגת המודל
    setTimeout(() => modal.classList.remove('hidden'), 10);

    // סגירת המודל
    const closeBtn = modal.querySelector('#close-summary-modal');
    const closeModal = () => {
      modal.classList.add('hidden');
      setTimeout(() => modal.remove(), 300);
    };

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
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

    const headers = ['תאריך/שעה', 'סוג קמפיין', 'נמען', 'שם', 'תוכן הודעה', 'סטטוס'];
    const rows = history.map(item => [
      new Date(item.timestamp).toLocaleString(),
      item.type === 'voice' ? 'קמפיין קולי' : 'SMS',
      item.recipient || `${item.recipients} נמענים`,
      item.name || '-',
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
  },

  addToHistory(item) {
    const history = storage.getItem('history', []);
    history.unshift(item);
    storage.setItem('history', history);
  }
};

// UI Management
const ui = {
  showSection(sectionName) {
    Object.values(elements.sections).forEach(section => 
      section.classList.add('hidden')
    );
    document.getElementById('incoming-section')?.classList.add('hidden');
    
    if (sectionName === 'incoming') {
      document.getElementById('incoming-section')?.classList.remove('hidden');
    } else {
      elements.sections[sectionName]?.classList.remove('hidden');
    }
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
        <td>
          <span class="campaign-type-badge ${item.type === 'voice' ? 'voice' : 'sms'}">
            <i class="ri-${item.type === 'voice' ? 'phone' : 'message-2'}-line"></i>
            ${item.type === 'voice' ? 'קמפיין קולי' : 'SMS'}
          </span>
        </td>
        <td>${item.recipient || `${item.recipients} נמענים`}</td>
        <td>${item.name || '-'}</td>
        <td>${item.message}</td>
        <td>
          <span class="status-badge ${item.status === 'נשלח בהצלחה' ? 'success' : 'error'}">
            ${item.status}
          </span>
        </td>
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

// נגדיר את contactManager לפני השימוש בו
const contactManager = new ContactManager();

// נעביר את ההגדרה של SystemManager למעלה, לפני ה-DOMContentLoaded
class SystemManager {
  constructor() {
    this.data = null;
    this.callerIDs = null;
  }

  async refresh() {
    const token = storage.getItem('token');
    if (!token) return;

    try {
      // קבלת נתוני המערכת
      this.data = await api.getSession(token);
      
      // קבלת זיהויי שולח מאושרים
      this.callerIDs = await api.getApprovedCallerIDs(token);
      
      this.updateUI();
    } catch (err) {
      console.error('שגיאה בטעינת נתוני מערכת:', err);
      if (err.message === "TOKEN_EXPIRED") {
        handleLogout(true);
      }
    }
  }

  updateUI() {
    if (!this.data) return;

    // עדכון פרטי המערכת בראש הדף
    const systemInfo = document.getElementById('system-info');
    if (systemInfo) {
      let infoHtml = '';
      if (this.data.name) infoHtml += `<span><i class="ri-user-line"></i>${this.data.name}</span>`;
      if (this.data.organization) infoHtml += `<span><i class="ri-building-line"></i>${this.data.organization}</span>`;
      if (this.data.units) infoHtml += `<span><i class="ri-coins-line"></i>${parseFloat(this.data.units).toFixed(1)} יחידות</span>`;
      systemInfo.innerHTML = infoHtml;
    }

    // עדכון כמות היחידות במסך השליחה
    const availableUnits = document.getElementById('available-units');
    if (availableUnits) {
      availableUnits.textContent = parseFloat(this.data.units || 0).toFixed(1);
    }

    // עדכון רשימת זיהויי השולח
    const senderIdSelect = document.getElementById('sender-id');
    if (senderIdSelect && this.callerIDs) {
      const currentValue = storage.getItem('senderNumber');
      
      // יצירת רשימת האפשרויות
      const options = [];
      
      // הוספת זיהוי SMS קבוע אם קיים
      if (this.callerIDs.sms.smsId) {
        options.push(this.callerIDs.sms.smsId);
      }
      
      // הוספת מספר ראשי
      if (this.callerIDs.call.mainDid) {
        options.push(this.callerIDs.call.mainDid);
      }
      
      // הוספת מספרים משניים
      if (this.callerIDs.call.secondaryDids) {
        options.push(...this.callerIDs.call.secondaryDids);
      }
      
      // הוספת זיהויים חיצוניים
      if (this.callerIDs.call.callerIds) {
        options.push(...this.callerIDs.call.callerIds);
      }
      
      // יצירת אלמנט select
      senderIdSelect.innerHTML = options.map(id => `
        <option value="${id}" ${id === currentValue ? 'selected' : ''}>
          ${formatPhoneNumber(id)}
        </option>
      `).join('');
      
      // הוספת מאזין לשינויים
      senderIdSelect.addEventListener('change', (e) => {
        storage.setItem('senderNumber', e.target.value);
      });
    }
  }
}

// נצירת מופע של SystemManager
const systemManager = new SystemManager();

// בוסיף פונקציה לטיפול בהתנתקות
function handleLogout(showMessage = false) {
  // מחיקת נתוני ההתחברות
  storage.removeItem('token');
  storage.removeItem('defaultSenderNumber');
  
  // הצגת מסך ההתחברות
  elements.loginScreen.classList.remove('hidden');
  elements.appScreen.classList.add('hidden');
  
  // ניקוי שדות הטופס
  elements.username.value = '';
  elements.password.value = '';

  // הצגת הודעה אם נדרש
  if (showMessage) {
    alert('פג תוקף ההתחברות - אנא בצע התחברות מחדש');
  }
}

// בתוך DOMContentLoaded נעדכן את הטיפול בהתחברות
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
      storage.setItem('senderNumber', elements.username.value);
      
      // טעינת נתוני המערכת
      await systemManager.refresh();
      
      // הצגת המסך הראשי
      elements.loginScreen.classList.add('hidden');
      elements.appScreen.classList.remove('hidden');
      
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
      handleLogout();
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
  async function initializeApp() {
    const token = storage.getItem('token');
    const defaultSenderNumber = storage.getItem('defaultSenderNumber');
    
    if (token) {
      try {
        // בדיקת תקינות הטוקן
        await api.getSession(token);
        
        // אם הגענו לכאן, הטוקן תקין
        elements.loginScreen.classList.add('hidden');
        elements.appScreen.classList.remove('hidden');
        
        // הגדרת מספר השולח בשדה
        document.getElementById('sender-id').value = defaultSenderNumber;
        
        // טעינת נתוני המערכת
        await systemManager.refresh();
        
        // טעינת הנתונים הראשונית
        ui.renderContacts(contactManager.contacts);
        ui.showSection('contacts');
      } catch (err) {
        if (err.message === "TOKEN_EXPIRED") {
          // מחיקת הטוקן הלא תקף
          storage.removeItem('token');
          storage.removeItem('defaultSenderNumber');
          handleLogout(true);
        } else {
          console.error('שגיאה באתחול:', err);
          handleLogout();
        }
      }
    } else {
      elements.loginScreen.classList.remove('hidden');
      elements.appScreen.classList.add('hidden');
      elements.username.value = '';
      elements.password.value = '';
    }
  }

  // הפעלת האתחול
  initializeApp();

  document.getElementById('export-contacts').addEventListener('click', () => {
    contactManager.exportToExcel();
  });

  // נוסיף מאזין לכפתור הרענון
  document.getElementById('refresh-units').addEventListener('click', () => {
    systemManager.refresh();
  });

  // Campaign Import Handlers
  document.getElementById('import-from-campaigns').addEventListener('click', () => {
    campaignsManager.showCampaignsModal();
  });

  document.getElementById('close-campaigns-modal').addEventListener('click', () => {
    document.getElementById('campaigns-modal').classList.add('hidden');
  });

  // Campaign Type Handlers
  document.querySelectorAll('input[name="campaign-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const voiceSettings = document.getElementById('voice-settings');
      if (e.target.value === 'voice') {
        voiceSettings.classList.remove('hidden');
      } else {
        voiceSettings.classList.add('hidden');
      }
    });
  });

  // Voice Speed Handler
  document.getElementById('voice-speed').addEventListener('input', (e) => {
    const value = e.target.value;
    const text = value == 0 ? 'רגיל (0)' : 
                value > 0 ? `מהיר (${value})` : 
                `איטי (${value})`;
    document.getElementById('speed-value').textContent = text;
  });

  // Incoming Messages Manager
  const incomingManager = {
    async loadMessages() {
      const token = storage.getItem('token');
      if (!token) return;

      const limit = document.getElementById('messages-limit').value;
      const dateFrom = document.getElementById('incoming-date-from').value;
      const dateTo = document.getElementById('incoming-date-to').value;

      try {
        const messages = await api.getSmsIncomingLog(token, limit, dateFrom, dateTo);
        this.renderMessages(messages || []);
      } catch (err) {
        if (err.message === "TOKEN_EXPIRED") {
          handleLogout(true);
        } else {
          alert(err.message);
        }
      }
    },

    renderMessages(messages) {
      const tbody = document.querySelector('#incoming-table tbody');
      tbody.innerHTML = '';

      if (!messages || messages.length === 0) {
        const noMessagesDiv = document.createElement('div');
        noMessagesDiv.className = 'no-messages';
        noMessagesDiv.innerHTML = `
          <div class="no-messages-content">
            <i class="ri-mail-close-line"></i>
            <p>לא נמצאו הודעות נכנסות במערכת</p>
            <p>ייתכן והמערכת שלכם אינה יכולה לקבל הודעות SMS, לפרטים נוספים יש לברר מול שירות הלקוחות של חברת ימות המשיח</p>
          </div>
        `;
        tbody.appendChild(noMessagesDiv);
        return;
      }

      messages.forEach(msg => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${msg.server_date}</td>
          <td>${formatPhoneNumber(msg.phone.toString())}</td>
          <td>${formatPhoneNumber(msg.dest.toString())}</td>
          <td>${msg.message}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  };

  // Incoming Messages Handlers
  document.getElementById('goto-incoming')?.addEventListener('click', () => {
    ui.showSection('incoming');
    incomingManager.loadMessages();
  });

  document.getElementById('refresh-incoming')?.addEventListener('click', () => {
    incomingManager.loadMessages();
  });

  document.getElementById('apply-incoming-filters')?.addEventListener('click', () => {
    incomingManager.loadMessages();
  });

  // Contact Modal Handlers
  const contactModal = document.getElementById('contact-modal');
  const showContactBtn = document.getElementById('show-contact');
  const closeContactBtn = document.getElementById('close-contact-modal');

  showContactBtn?.addEventListener('click', () => {
    contactModal?.classList.remove('hidden');
  });

  closeContactBtn?.addEventListener('click', () => {
    contactModal?.classList.add('hidden');
  });

  // סגירת המודל בלחיצה על הרקע
  contactModal?.addEventListener('click', (e) => {
    if (e.target === contactModal) {
      contactModal.classList.add('hidden');
    }
  });

  // סגירת המודל בלחיצה על ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !contactModal?.classList.contains('hidden')) {
      contactModal?.classList.add('hidden');
    }
  });

  // Mobile Menu Handler
  const menuToggle = document.createElement('button');
  menuToggle.id = 'menu-toggle';
  menuToggle.className = 'menu-toggle';
  menuToggle.innerHTML = '<i class="ri-menu-line"></i>';

  // הוספת כפתור ההמבורגר לתוך main-hed
  const mainHed = document.querySelector('.main-hed');
  const navLinks = document.querySelector('.nav-links');
  mainHed.appendChild(menuToggle);

  menuToggle.addEventListener('click', () => {
    navLinks.classList.toggle('show');
    const icon = menuToggle.querySelector('i');
    icon.className = navLinks.classList.contains('show') ? 
        'ri-close-line' : 'ri-menu-line';
  });

  // סגירת התפריט בלחיצה על קישור
  navLinks.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
      navLinks.classList.remove('show');
      menuToggle.querySelector('i').className = 'ri-menu-line';
    });
  });
}); 

// Message Cost Calculator
const messageCost = {
  calculateUnits(text, variables = [], isVoiceCampaign = false) {
    if (isVoiceCampaign) {
      // חישוב יחידות לקמפיין קולי - יחידה לדקה
      const wordsPerMinute = 150; // מהירות דיבור ממוצעת
      const estimatedWords = text.split(/\s+/).length;
      const estimatedMinutes = Math.ceil(estimatedWords / wordsPerMinute);
      return estimatedMinutes;
    } else {
      // חישוב יחידות SMS
      const estimatedLength = variables.reduce((total, variable) => {
        return total + (variable.length || 0);
      }, text.length);
      return Math.ceil(estimatedLength / 70);
    }
  },

  updateCostSummary() {
    const text = document.getElementById('message-template').value;
    const recipientsCount = contactManager.contacts.length;
    const messageLength = text.length;
    const isVoiceCampaign = document.querySelector('input[name="campaign-type"]:checked').value === 'voice';
    
    // חישוב אורך משוער כולל משתנים
    const variables = contactManager.contacts[0] ? [
      contactManager.contacts[0].name.length,
      contactManager.contacts[0].var1?.length || 0,
      contactManager.contacts[0].var2?.length || 0,
      contactManager.contacts[0].var3?.length || 0,
      contactManager.contacts[0].var4?.length || 0,
      contactManager.contacts[0].var5?.length || 0
    ] : [];
    
    const unitsPerRecipient = this.calculateUnits(text, variables, isVoiceCampaign);
    const totalUnits = unitsPerRecipient * recipientsCount;
    
    // עדכון הטקסט בהתאם לסוג הקמפיין
    document.getElementById('message-length').textContent = messageLength;
    document.getElementById('recipients-count').textContent = recipientsCount;
    document.getElementById('estimated-cost').textContent = totalUnits;
    
    const costSummaryText = document.querySelector('.cost-item:nth-child(3) span');
    if (isVoiceCampaign) {
      costSummaryText.innerHTML = `עלות משוערת: <strong id="estimated-cost">${totalUnits}</strong> יחידות רגילות`;
    } else {
      costSummaryText.innerHTML = `עלות משוערת: <strong id="estimated-cost">${totalUnits}</strong> יחידות SMS (<strong id="regular-units">${(totalUnits * 0.1).toFixed(1)}</strong> יחידות רגילות)`;
    }
    
    // עדכון מונה תווים
    document.getElementById('char-count').textContent = messageLength;
  }
}; 

// נוסיף את הלוגיקה של הקמפיינים
const campaignsManager = {
  async showCampaignsModal() {
    const modal = document.getElementById('campaigns-modal');
    const loading = document.getElementById('campaigns-loading');
    const list = document.getElementById('campaigns-list');
    
    try {
      modal.classList.remove('hidden');
      loading.classList.remove('hidden');
      list.innerHTML = '';
      
      const token = storage.getItem('token');
      if (!token) {
        throw new Error('לא נמצא טוקן התחברות');
      }

      const templates = await api.getTemplates(token);
      
      if (!templates || !templates.length) {
        list.innerHTML = '<div class="text-center">לא נמצאו קמפיינים</div>';
        loading.classList.add('hidden');
        return;
      }
      
      loading.classList.add('hidden');
      list.innerHTML = templates.map(template => `
        <div class="campaign-item" data-id="${template.templateId}">
          <div class="campaign-title">
            ${template.description || 'קמפיין ללא שם'}
            ${template.customerDefault ? ' (ברירת מחדל)' : ''}
          </div>
          <div class="campaign-details">
            <div>מספר אנשי קשר: ${template.entriesCount}</div>
            <div>מזהה שיחה: ${template.callerId || ''}</div>
          </div>
        </div>
      `).join('');
      
      // הוספת מאזיני לחיצה לכל קמפיין
      list.querySelectorAll('.campaign-item').forEach(item => {
        item.addEventListener('click', () => {
          if (confirm('האם ברצונך לייבא את אנשי הקשר מקמפיין זה?')) {
            this.importFromCampaign(item.dataset.id);
          }
        });
      });
      
    } catch (err) {
      console.error('שגיאה בטעינת קמפיינים:', err);
      if (err.message === "TOKEN_EXPIRED") {
        handleLogout(true);
      } else {
        loading.classList.add('hidden');
        list.innerHTML = `
          <div class="error-message text-center">
            <i class="ri-error-warning-line"></i>
            <p>שגיאה בטעינת הקמפיינים</p>
            <p class="text-small">${err.message}</p>
          </div>`;
      }
    }
  },
  
  async importFromCampaign(templateId) {
    const modal = document.getElementById('campaigns-modal');
    const loading = document.getElementById('campaigns-loading');
    const list = document.getElementById('campaigns-list');
    
    try {
      // הצגת טעינה
      list.innerHTML = `
        <div class="text-center">
          <i class="ri-loader-4-line rotating"></i>
          <p>מייבא אנשי קשר...</p>
        </div>
      `;
      
      const token = storage.getItem('token');
      const entries = await api.getTemplateEntries(token, templateId);
      
      // מיון והסרת חסומים
      const validEntries = entries
        .filter(entry => !entry.blocked)
        .sort((a, b) => a.index - b.index);
      
      // המרה לפורמט של המערכת שלנו
      const importedContacts = validEntries.map(entry => ({
        name: entry.name || '',
        phone: entry.phone,
        var1: entry.moreinfo || '',
        var2: '',
        var3: '',
        var4: '',
        var5: ''
      }));
      
      // שאלה האם להחליף או להוסיף
      const action = await this.showImportDialog(importedContacts.length);
      
      // אם המשתמש סגר את החלון בלי לבחור פעולה
      if (!action) {
        modal.classList.add('hidden');
        return;
      }

      if (action === 'append') {
        // הוספה לרשימה הקיימת
        importedContacts.forEach(contact => {
          contactManager.add(contact);
        });
      } else if (action === 'replace') {
        // החלפת כל הרשימה
        contactManager.contacts = [];
        importedContacts.forEach(contact => {
          contactManager.add(contact);
        });
      }
      
      // עדכון הטבלה
      ui.renderContacts(contactManager.contacts);
      
      // סגירת המודל
      modal.classList.add('hidden');
      
    } catch (err) {
      if (err.message === "TOKEN_EXPIRED") {
        handleLogout(true);
      } else {
        alert(`שגיאה בייבוא אנשי קשר: ${err.message}`);
      }
    }
  },
  
  showImportDialog(count) {
    return new Promise((resolve) => {
      const currentCount = contactManager.contacts.length;
      
      const message = `נמצאו ${count} אנשי קשר בקמפיין.
${currentCount ? `\nברשימה הקיימת יש ${currentCount} אנשי קשר.` : ''}
\nכיצד ברצונך לייבא את אנשי הקשר?`;
      
      const dialog = document.createElement('div');
      dialog.className = 'modal';
      dialog.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
          <div class="modal-header">
            <h3>אפשרויות ייבוא</h3>
            <button type="button" class="btn-close" aria-label="סגור">×</button>
          </div>
          <div class="modal-body">
            <p>${message}</p>
            <div class="import-actions" style="display: flex; gap: 1rem; margin-top: 1rem;">
              <button class="btn btn-secondary" data-action="append">
                <i class="ri-add-line"></i>
                הוסף לרשימה הקיימת
              </button>
              <button class="btn btn-primary" data-action="replace">
                <i class="ri-refresh-line"></i>
                החלף את הרשימה
              </button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(dialog);
      
      // פונקציית סגירה
      const closeDialog = () => {
        dialog.remove();
        resolve(null);
      };

      // יצירת מאזין ה-ESC
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', escHandler);
          closeDialog();
        }
      };
      
      // סגירה בלחיצה על X
      dialog.querySelector('.btn-close').addEventListener('click', closeDialog);
      
      // סגירה בלחיצה על ESC
      document.addEventListener('keydown', escHandler);
      
      // סגירה בלחיצה על הרקע
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
          document.removeEventListener('keydown', escHandler);
          closeDialog();
        }
      });
      
      // מאזיני לחיצה על כפתורי הפעולה
      dialog.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          document.removeEventListener('keydown', escHandler);
          dialog.remove();
          resolve(action);
        });
      });
    });
  }
}; 

// עדכון פונקציית השליחה
async function sendMessage(contact, message, campaignType = 'sms') {
  const token = storage.getItem('token');
  if (!token) throw new Error('לא נמצא טוקן תקף');

  // החלפת המשתנים בהודעה
  let finalMessage = message;
  finalMessage = finalMessage.replace(/\{שם\}/g, contact.name || '');
  finalMessage = finalMessage.replace(/\{משתנה1\}/g, contact.var1 || '');
  finalMessage = finalMessage.replace(/\{משתנה2\}/g, contact.var2 || '');
  finalMessage = finalMessage.replace(/\{משתנה3\}/g, contact.var3 || '');
  finalMessage = finalMessage.replace(/\{משתנה4\}/g, contact.var4 || '');
  finalMessage = finalMessage.replace(/\{משתנה5\}/g, contact.var5 || '');

  try {
    if (campaignType === 'voice') {
      // ... קוד קיים לשליחת הודעה קולית
    } else {
      const params = {
        message: finalMessage,
        senderId: document.getElementById('sender-id').value,
        dest: contact.phone,
        flash: document.getElementById('flash-message').checked
      };
      await api.sendSMS(token, params);
    }
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
} 