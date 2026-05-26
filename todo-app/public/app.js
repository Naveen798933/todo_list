// ==========================================================================
// TaskFlow Client Application Logic (Enhanced Features Upgrade)
// ==========================================================================

// Global Application State
let tasksState = [];
let activeFilter = 'all';
let activeSearchQuery = '';
let activeSortOption = 'created-desc';
let editingTaskId = null;

// DOM Elements Cache
const DOM = {
  taskForm: document.getElementById('task-form'),
  taskInput: document.getElementById('task-input'),
  taskPriority: document.getElementById('task-priority'),
  taskCategory: document.getElementById('task-category'),
  taskDueDate: document.getElementById('task-due-date'),
  
  taskList: document.getElementById('task-list'),
  loader: document.getElementById('tasks-loader'),
  emptyState: document.getElementById('empty-state'),
  emptyStateMessage: document.getElementById('empty-state-message'),
  
  statsFraction: document.getElementById('stats-fraction'),
  statsPercent: document.getElementById('stats-percent'),
  progressBarFill: document.getElementById('progress-bar-fill'),
  
  // Navigation & Controls
  filterAll: document.getElementById('filter-all'),
  filterPending: document.getElementById('filter-pending'),
  filterCompleted: document.getElementById('filter-completed'),
  searchInput: document.getElementById('search-input'),
  sortSelect: document.getElementById('sort-select'),
  clearCompletedBtn: document.getElementById('clear-completed-btn'),
  
  // Theme customizer dots panel
  themeSwitcher: document.querySelector('.theme-switcher-container'),
  
  // Edit Modal Elements
  editModal: document.getElementById('edit-modal'),
  editForm: document.getElementById('edit-form'),
  editInput: document.getElementById('edit-task-input'),
  editPriority: document.getElementById('edit-task-priority'),
  editCategory: document.getElementById('edit-task-category'),
  editDueDate: document.getElementById('edit-task-due-date'),
  modalCancelBtn: document.getElementById('modal-cancel-btn'),
  
  // Toast Notification Container
  toastContainer: document.getElementById('toast-container')
};

// API Endpoint Configuration
const API_URL = '/tasks';

// Initialize App on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadTasks();
  setupEventListeners();
});

// ==========================================================================
// Theme Accent Initialization & Switcher
// ==========================================================================
function initTheme() {
  const savedTheme = localStorage.getItem('taskflow-theme') || 'indigo';
  setTheme(savedTheme);
  
  // Mark the active dot
  const dots = DOM.themeSwitcher.querySelectorAll('.theme-dot');
  dots.forEach(dot => {
    if (dot.getAttribute('data-theme') === savedTheme) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });
}

function setTheme(themeName) {
  // Clear all theme classes from body
  document.body.className = '';
  document.body.classList.add(`theme-${themeName}`);
  localStorage.setItem('taskflow-theme', themeName);
}

// ==========================================================================
// Event Listeners Setup
// ==========================================================================
function setupEventListeners() {
  // Add Task Form submission
  DOM.taskForm.addEventListener('submit', handleAddTask);
  
  // Task actions (checkbox, edit, delete) using Event Delegation
  DOM.taskList.addEventListener('click', handleTaskAction);
  
  // Filter tabs navigation
  const filterButtons = [DOM.filterAll, DOM.filterPending, DOM.filterCompleted];
  filterButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const filter = e.target.getAttribute('data-filter');
      activeFilter = filter;
      
      // Update UI active state classes
      filterButtons.forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      
      renderTasks();
    });
  });
  
  // Search input typing
  DOM.searchInput.addEventListener('input', (e) => {
    activeSearchQuery = e.target.value.toLowerCase().trim();
    renderTasks();
  });
  
  // Sort select changes
  DOM.sortSelect.addEventListener('change', (e) => {
    activeSortOption = e.target.value;
    renderTasks();
  });
  
  // Clear completed batch deletion button
  DOM.clearCompletedBtn.addEventListener('click', handleClearCompleted);
  
  // Theme switcher clicks
  DOM.themeSwitcher.addEventListener('click', (e) => {
    const dot = e.target.closest('.theme-dot');
    if (!dot) return;
    
    const theme = dot.getAttribute('data-theme');
    setTheme(theme);
    
    // Toggle active dot layout
    DOM.themeSwitcher.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
    dot.classList.add('active');
    showToast(`Accent theme updated to ${theme}`, 'info');
  });

  // Modal close handlers
  DOM.modalCancelBtn.addEventListener('click', closeEditModal);
  DOM.editModal.addEventListener('click', (e) => {
    if (e.target === DOM.editModal) closeEditModal();
  });
  
  // Modal form submit
  DOM.editForm.addEventListener('submit', handleSaveEdit);
  
  // Keyboard shortcut to close modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !DOM.editModal.classList.contains('hidden')) {
      closeEditModal();
    }
  });
}

// ==========================================================================
// Service API Integrations (Fetch, Add, Update, Delete, Clear Completed)
// ==========================================================================

// Load tasks from database
async function loadTasks() {
  showLoader();
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('Failed to fetch tasks');
    
    tasksState = await response.json();
    renderTasks();
  } catch (error) {
    console.error(error);
    showToast('Failed to connect to database. Please check backend server.', 'error');
    DOM.emptyStateMessage.textContent = 'Unable to sync database. Is your MongoDB server running?';
    showEmptyState();
  } finally {
    hideLoader();
  }
}

// Handle Add Task Submission
async function handleAddTask(e) {
  e.preventDefault();
  const title = DOM.taskInput.value.trim();
  const priority = DOM.taskPriority.value;
  const category = DOM.taskCategory.value.trim();
  const dueDate = DOM.taskDueDate.value;
  
  if (!title) return;
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        title, 
        priority, 
        category: category || undefined, 
        dueDate: dueDate || undefined 
      })
    });
    
    if (!response.ok) throw new Error('Failed to create task');
    
    const newTask = await response.json();
    
    // Add to front of array to match backend sorting
    tasksState.unshift(newTask);
    
    // Reset Form Input fields
    DOM.taskInput.value = '';
    DOM.taskPriority.value = 'medium';
    DOM.taskCategory.value = '';
    DOM.taskDueDate.value = '';
    
    renderTasks();
    showToast('Task added successfully', 'success');
  } catch (error) {
    console.error(error);
    showToast('Failed to add task', 'error');
  }
}

// Handle Task action (Toggling checkbox or Edit or Delete buttons)
async function handleTaskAction(e) {
  const target = e.target;
  
  // 1. Toggle Checkbox Complete/Incomplete
  const checkbox = target.closest('.checkbox-container');
  if (checkbox) {
    const taskId = checkbox.getAttribute('data-id');
    const task = tasksState.find(t => t._id === taskId);
    if (!task) return;
    
    const originalStatus = task.completed;
    
    // Optimistic UI updates
    task.completed = !task.completed;
    renderTasks();
    
    try {
      const response = await fetch(`${API_URL}/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: task.completed })
      });
      
      if (!response.ok) throw new Error('Failed to update task status');
      
      const updatedTask = await response.json();
      const index = tasksState.findIndex(t => t._id === taskId);
      if (index !== -1) tasksState[index] = updatedTask;
      
      showToast(
        updatedTask.completed ? 'Task marked as completed' : 'Task marked as pending',
        'info'
      );
      renderTasks();
    } catch (error) {
      console.error(error);
      task.completed = originalStatus; // Revert
      renderTasks();
      showToast('Failed to update task status', 'error');
    }
    return;
  }
  
  // 2. Open Edit Modal
  const editBtn = target.closest('.action-btn-edit');
  if (editBtn) {
    const taskId = editBtn.getAttribute('data-id');
    openEditModal(taskId);
    return;
  }
  
  // 3. Delete Task
  const deleteBtn = target.closest('.action-btn-delete');
  if (deleteBtn) {
    const taskId = deleteBtn.getAttribute('data-id');
    const taskItem = deleteBtn.closest('.task-item');
    
    // Trigger exit animation before API call finishes
    taskItem.classList.add('item-exit');
    
    setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/${taskId}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete task');
        
        tasksState = tasksState.filter(t => t._id !== taskId);
        renderTasks();
        showToast('Task deleted successfully', 'success');
      } catch (error) {
        console.error(error);
        taskItem.classList.remove('item-exit');
        renderTasks();
        showToast('Failed to delete task', 'error');
      }
    }, 250);
  }
}

// Handle Save Edit Form Submission
async function handleSaveEdit(e) {
  e.preventDefault();
  const updatedTitle = DOM.editInput.value.trim();
  const updatedPriority = DOM.editPriority.value;
  const updatedCategory = DOM.editCategory.value.trim();
  const updatedDueDate = DOM.editDueDate.value;
  
  if (!updatedTitle || !editingTaskId) return;
  
  try {
    const response = await fetch(`${API_URL}/${editingTaskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        title: updatedTitle,
        priority: updatedPriority,
        category: updatedCategory || 'General',
        dueDate: updatedDueDate || null
      })
    });
    
    if (!response.ok) throw new Error('Failed to update task');
    
    const updatedTask = await response.json();
    
    const index = tasksState.findIndex(t => t._id === editingTaskId);
    if (index !== -1) {
      tasksState[index] = updatedTask;
    }
    
    closeEditModal();
    renderTasks();
    showToast('Task updated successfully', 'success');
  } catch (error) {
    console.error(error);
    showToast('Failed to update task', 'error');
  }
}

// Handle Batch Clear Completed
async function handleClearCompleted() {
  const completedCount = tasksState.filter(t => t.completed).length;
  if (completedCount === 0) {
    showToast('No completed tasks to clear', 'info');
    return;
  }
  
  if (!confirm(`Are you sure you want to delete all ${completedCount} completed tasks?`)) {
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/clear-completed`, {
      method: 'POST'
    });
    
    if (!response.ok) throw new Error('Failed to clear completed tasks');
    
    const data = await response.json();
    
    // Update local state by removing completed items
    tasksState = tasksState.filter(t => !t.completed);
    renderTasks();
    showToast(`Cleared ${data.deletedCount || completedCount} completed tasks`, 'success');
  } catch (error) {
    console.error(error);
    showToast('Failed to clear completed tasks', 'error');
  }
}

// ==========================================================================
// Sorting, Filtering & Search Pipeline
// ==========================================================================

function getProcessedTasks() {
  // 1. Filter Tasks by Category Navigation tab
  let list = tasksState.filter(task => {
    if (activeFilter === 'pending') return !task.completed;
    if (activeFilter === 'completed') return task.completed;
    return true; // 'all'
  });
  
  // 2. Filter Tasks by active Search query (Checks title and category)
  if (activeSearchQuery) {
    list = list.filter(task => 
      task.title.toLowerCase().includes(activeSearchQuery) || 
      task.category.toLowerCase().includes(activeSearchQuery)
    );
  }
  
  // 3. Sort Tasks
  list.sort((a, b) => {
    switch (activeSortOption) {
      case 'created-asc':
        return new Date(a.createdAt) - new Date(b.createdAt);
        
      case 'created-desc':
        return new Date(b.createdAt) - new Date(a.createdAt);
        
      case 'due-asc':
        // Move items without due dates to the bottom stably
        if (!a.dueDate && !b.dueDate) {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
        
      case 'priority-desc':
        const weights = { high: 3, medium: 2, low: 1 };
        const weightA = weights[a.priority] || 2;
        const weightB = weights[b.priority] || 2;
        
        if (weightA !== weightB) {
          return weightB - weightA; // High priority first
        }
        // Sub-sort by date created if priorities match
        return new Date(b.createdAt) - new Date(a.createdAt);
        
      default:
        return 0;
    }
  });
  
  return list;
}

// ==========================================================================
// DOM Renderers & Layout Logic
// ==========================================================================

// Main Render Function
function renderTasks() {
  DOM.taskList.innerHTML = '';
  
  // Run tasks through the processing pipeline (Filter -> Search -> Sort)
  const processedList = getProcessedTasks();
  
  // Update dashboard counters
  updateStats();
  
  if (processedList.length === 0) {
    if (activeSearchQuery) {
      DOM.emptyStateMessage.textContent = 'No tasks match your search query.';
    } else if (activeFilter === 'pending') {
      DOM.emptyStateMessage.textContent = 'Great job! You have no pending tasks.';
    } else if (activeFilter === 'completed') {
      DOM.emptyStateMessage.textContent = 'No completed tasks found. Time to check off some items!';
    } else {
      DOM.emptyStateMessage.textContent = 'Your schedule is clean. Add a task above to get started!';
    }
    showEmptyState();
    return;
  }
  
  hideEmptyState();
  
  // Render task list items
  processedList.forEach(task => {
    const li = document.createElement('li');
    li.className = `task-item ${task.completed ? 'completed-item' : ''}`;
    li.setAttribute('data-id', task._id);
    
    // Checkbox container
    const isChecked = task.completed ? 'checked' : '';
    const ariaCheckLabel = task.completed ? 'Mark task as incomplete' : 'Mark task as complete';
    
    // Priority badge
    const pLabel = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
    const pClass = `priority-badge priority-${task.priority}-badge`;
    
    // Category label
    const categoryText = escapeHTML(task.category || 'General');
    
    // Due date label & calculations
    let dueDateHTML = '';
    if (task.dueDate) {
      const { label, isOverdue, isSoon } = formatDueDate(task.dueDate, task.completed);
      const overdueClass = isOverdue ? 'date-tag-overdue' : (isSoon ? 'date-tag-soon' : '');
      
      dueDateHTML = `
        <span class="date-tag ${overdueClass}" title="Due Date: ${new Date(task.dueDate).toLocaleDateString()}">
          <svg class="date-tag-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>${label}</span>
        </span>
      `;
    }
    
    li.innerHTML = `
      <div class="task-content-group">
        <button 
          class="checkbox-container ${isChecked}" 
          data-id="${task._id}"
          aria-label="${ariaCheckLabel}"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
        </button>
        
        <div class="task-details">
          <span class="task-title" title="${escapeHTML(task.title)}">${escapeHTML(task.title)}</span>
          <div class="task-metadata-tags">
            <span class="${pClass}">${pLabel}</span>
            <span class="category-badge">${categoryText}</span>
            ${dueDateHTML}
          </div>
        </div>
      </div>
      
      <div class="task-actions">
        <button 
          class="action-btn action-btn-edit" 
          data-id="${task._id}" 
          aria-label="Edit Task"
          title="Edit Details"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button 
          class="action-btn action-btn-delete" 
          data-id="${task._id}" 
          aria-label="Delete Task"
          title="Delete Task"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    `;
    
    DOM.taskList.appendChild(li);
  });
}

// Update stats dashboard completion percentages
function updateStats() {
  const total = tasksState.length;
  const completed = tasksState.filter(t => t.completed).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  DOM.statsFraction.textContent = `${completed}/${total}`;
  DOM.statsPercent.textContent = `${percent}%`;
  DOM.progressBarFill.style.width = `${percent}%`;
}

// Modal Controllers
function openEditModal(taskId) {
  const task = tasksState.find(t => t._id === taskId);
  if (!task) return;
  
  editingTaskId = taskId;
  DOM.editInput.value = task.title;
  DOM.editPriority.value = task.priority || 'medium';
  DOM.editCategory.value = task.category || 'General';
  
  if (task.dueDate) {
    // Format to yyyy-MM-dd for HTML date input using UTC to prevent timezone shifts
    const dateObj = new Date(task.dueDate);
    const year = dateObj.getUTCFullYear();
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getUTCDate()).padStart(2, '0');
    DOM.editDueDate.value = `${year}-${month}-${day}`;
  } else {
    DOM.editDueDate.value = '';
  }
  
  DOM.editModal.classList.remove('hidden');
  DOM.editModal.setAttribute('aria-hidden', 'false');
  DOM.editInput.focus();
}

function closeEditModal() {
  editingTaskId = null;
  DOM.editInput.value = '';
  DOM.editPriority.value = 'medium';
  DOM.editCategory.value = '';
  DOM.editDueDate.value = '';
  DOM.editModal.classList.add('hidden');
  DOM.editModal.setAttribute('aria-hidden', 'true');
}

// ==========================================================================
// Helper Utility Functions
// ==========================================================================

// Formats a raw database ISO Date string into relative text
function formatDueDate(isoString, isCompleted) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(isoString);
  const localDueDate = new Date(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  
  const diffTime = localDueDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (isCompleted) {
    return { label: `Due ${localDueDate.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}`, isOverdue: false, isSoon: false };
  }
  
  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    const dayWord = absDays === 1 ? 'day' : 'days';
    return { label: `Overdue by ${absDays} ${dayWord}!`, isOverdue: true, isSoon: false };
  }
  
  if (diffDays === 0) {
    return { label: 'Due today', isOverdue: false, isSoon: true };
  }
  
  if (diffDays === 1) {
    return { label: 'Due tomorrow', isOverdue: false, isSoon: true };
  }
  
  if (diffDays <= 3) {
    return { label: `Due in ${diffDays} days`, isOverdue: false, isSoon: true };
  }
  
  return { 
    label: `Due ${localDueDate.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}`, 
    isOverdue: false, 
    isSoon: false 
  };
}

// Escapes special characters to avoid XSS injections
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Toggle Spinner Loaders
function showLoader() {
  DOM.loader.classList.remove('hidden');
}

function hideLoader() {
  DOM.loader.classList.add('hidden');
}

// Toggle Empty State Graphics
function showEmptyState() {
  DOM.emptyState.classList.remove('hidden');
}

function hideEmptyState() {
  DOM.emptyState.classList.add('hidden');
}

// Display Custom Toast Alert Notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconSVG = '';
  if (type === 'success') {
    iconSVG = `
      <svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    `;
  } else if (type === 'error') {
    iconSVG = `
      <svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    `;
  } else { // info
    iconSVG = `
      <svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    `;
  }
  
  toast.innerHTML = `${iconSVG}<span>${message}</span>`;
  
  DOM.toastContainer.appendChild(toast);
  
  // Slide out animation trigger and DOM cleanup
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => {
      toast.remove();
    }, 250);
  }, 3500);
}
