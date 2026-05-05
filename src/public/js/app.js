(function () {
  'use strict';

  const API_BASE = '/api/todos';
  let currentFilter = 'all';
  let currentSort = 'created_at';
  let currentOrder = 'DESC';
  let currentPage = 1;
  let searchTimeout = null;

  // DOM Elements
  const todoList = document.getElementById('todoList');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const createForm = document.getElementById('createTodoForm');
  const editModal = document.getElementById('editModal');
  const editForm = document.getElementById('editTodoForm');
  const paginationEl = document.getElementById('pagination');
  const searchInput = document.getElementById('searchInput');
  const sortField = document.getElementById('sortField');
  const sortOrderBtn = document.getElementById('sortOrder');
  const clearCompletedBtn = document.getElementById('clearCompletedBtn');
  const closeModalBtn = document.getElementById('closeModal');
  const cancelEditBtn = document.getElementById('cancelEdit');

  // Theme
  var themeToggleBtn = document.getElementById('themeToggle');

  function updateThemeIcon() {
    if (!themeToggleBtn) return;
    var saved = localStorage.getItem('theme');
    if (saved === 'light') {
      themeToggleBtn.innerHTML = '&#9728;';
      themeToggleBtn.title = 'Theme: Light';
    } else if (saved === 'dark') {
      themeToggleBtn.innerHTML = '&#9790;';
      themeToggleBtn.title = 'Theme: Dark';
    } else {
      themeToggleBtn.innerHTML = '&#9681;';
      themeToggleBtn.title = 'Theme: Auto';
    }
  }

  function cycleTheme() {
    var current = localStorage.getItem('theme');
    var next;
    if (!current) {
      next = 'light';
    } else if (current === 'light') {
      next = 'dark';
    } else {
      next = null;
    }
    if (next) {
      localStorage.setItem('theme', next);
      document.documentElement.dataset.theme = next;
    } else {
      localStorage.removeItem('theme');
      document.documentElement.removeAttribute('data-theme');
    }
    updateThemeIcon();
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', function () {
    updateThemeIcon();
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', cycleTheme);
    loadTodos();
    loadStats();
    bindEvents();
  });

  function bindEvents() {
    createForm.addEventListener('submit', handleCreateTodo);
    editForm.addEventListener('submit', handleEditTodo);

    document.querySelectorAll('.btn-filter').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.btn-filter').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        currentPage = 1;
        loadTodos();
      });
    });

    sortField.addEventListener('change', function () {
      currentSort = sortField.value;
      loadTodos();
    });

    sortOrderBtn.addEventListener('click', function () {
      currentOrder = currentOrder === 'DESC' ? 'ASC' : 'DESC';
      sortOrderBtn.innerHTML = currentOrder === 'DESC' ? '&#8595;' : '&#8593;';
      loadTodos();
    });

    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(function () {
        currentPage = 1;
        loadTodos();
      }, 300);
    });

    clearCompletedBtn.addEventListener('click', handleClearCompleted);
    closeModalBtn.addEventListener('click', closeEditModal);
    cancelEditBtn.addEventListener('click', closeEditModal);

    editModal.addEventListener('click', function (e) {
      if (e.target === editModal) closeEditModal();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeEditModal();
    });
  }

  // API helpers
  async function apiRequest(url, options) {
    try {
      var response = await fetch(url, Object.assign({
        headers: { 'Content-Type': 'application/json' },
      }, options));
      var data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ? data.error.message : 'Request failed');
      }
      return data;
    } catch (error) {
      showToast(error.message, 'error');
      throw error;
    }
  }

  // Load todos
  async function loadTodos() {
    loadingSpinner.style.display = 'block';
    var params = new URLSearchParams();
    params.set('page', currentPage);
    params.set('limit', '20');
    params.set('sort', currentSort);
    params.set('order', currentOrder);

    if (currentFilter === 'completed') params.set('completed', 'true');
    if (currentFilter === 'pending') params.set('completed', 'false');

    var searchVal = searchInput.value.trim();
    if (searchVal) params.set('search', searchVal);

    try {
      var result = await apiRequest(API_BASE + '?' + params.toString());
      renderTodos(result.data);
      renderPagination(result.pagination);
    } catch (_e) {
      todoList.innerHTML = '<div class="empty-state"><h3>Failed to load todos</h3><p>Please try refreshing the page.</p></div>';
    } finally {
      loadingSpinner.style.display = 'none';
    }
  }

  // Load stats
  async function loadStats() {
    try {
      var result = await apiRequest(API_BASE + '/stats');
      var stats = result.data;
      document.getElementById('statTotal').textContent = stats.total + ' total';
      document.getElementById('statPending').textContent = stats.pending + ' pending';
      document.getElementById('statCompleted').textContent = stats.completed + ' done';
      document.getElementById('statOverdue').textContent = stats.overdue + ' overdue';
    } catch (_e) {
      // Stats loading is non-critical
    }
  }

  // Render todos
  function renderTodos(todos) {
    if (!todos || todos.length === 0) {
      todoList.innerHTML = '<div class="empty-state"><h3>No todos found</h3><p>Create your first todo to get started!</p></div>';
      return;
    }

    todoList.innerHTML = todos.map(function (todo) {
      var isOverdue = todo.due_date && !todo.completed && new Date(todo.due_date) < new Date();
      var tagsHtml = (todo.tags || []).map(function (tag) {
        return '<span class="todo-tag">' + escapeHtml(tag) + '</span>';
      }).join('');
      var dueDateHtml = todo.due_date
        ? '<span class="todo-due ' + (isOverdue ? 'overdue' : '') + '">' + formatDate(todo.due_date) + '</span>'
        : '';

      return '<div class="todo-item ' + (todo.completed ? 'completed' : '') + '" data-id="' + todo.id + '">' +
        '<input type="checkbox" class="todo-checkbox" ' + (todo.completed ? 'checked' : '') + ' data-action="toggle">' +
        '<div class="todo-content">' +
        '<div class="todo-title">' + escapeHtml(todo.title) + '</div>' +
        (todo.description ? '<div class="todo-description">' + escapeHtml(todo.description) + '</div>' : '') +
        '<div class="todo-meta">' +
        '<span class="priority-badge priority-' + todo.priority + '">' + todo.priority + '</span>' +
        dueDateHtml +
        tagsHtml +
        '</div>' +
        '</div>' +
        '<div class="todo-actions">' +
        '<button class="btn-icon" data-action="edit" title="Edit">&#9998;</button>' +
        '<button class="btn-icon btn-delete" data-action="delete" title="Delete">&#10005;</button>' +
        '</div>' +
        '</div>';
    }).join('');

    // Attach event listeners via delegation
    todoList.querySelectorAll('.todo-item').forEach(function (item) {
      var id = item.dataset.id;
      item.querySelector('[data-action="toggle"]').addEventListener('click', function () {
        toggleTodo(id);
      });
      item.querySelector('[data-action="edit"]').addEventListener('click', function () {
        openEdit(id);
      });
      item.querySelector('[data-action="delete"]').addEventListener('click', function () {
        deleteTodo(id);
      });
    });
  }

  // Render pagination
  function renderPagination(pagination) {
    if (!pagination || pagination.totalPages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }

    paginationEl.innerHTML =
      '<button id="pagePrev" ' + (pagination.hasPrev ? '' : 'disabled') + '>Prev</button>' +
      '<span class="page-info">Page ' + pagination.page + ' of ' + pagination.totalPages + '</span>' +
      '<button id="pageNext" ' + (pagination.hasNext ? '' : 'disabled') + '>Next</button>';

    var prevBtn = document.getElementById('pagePrev');
    var nextBtn = document.getElementById('pageNext');
    if (prevBtn) prevBtn.addEventListener('click', function () { goToPage(pagination.page - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goToPage(pagination.page + 1); });
  }

  // Create todo
  async function handleCreateTodo(e) {
    e.preventDefault();
    var title = document.getElementById('todoTitle').value.trim();
    if (!title) return;

    var tagsRaw = document.getElementById('todoTags').value.trim();
    var tags = tagsRaw ? tagsRaw.split(',').map(function (t) { return t.trim(); }).filter(Boolean) : [];
    var dueDate = document.getElementById('todoDueDate').value || null;

    var body = {
      title: title,
      description: document.getElementById('todoDescription').value.trim(),
      priority: document.getElementById('todoPriority').value,
      tags: tags,
    };
    if (dueDate) body.due_date = dueDate;

    try {
      await apiRequest(API_BASE, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      createForm.reset();
      document.getElementById('todoPriority').value = 'medium';
      showToast('Task created!', 'success');
      loadTodos();
      loadStats();
    } catch (_e) {
      // error already handled
    }
  }

  // Edit todo
  async function openEdit(id) {
    try {
      var result = await apiRequest(API_BASE + '/' + id);
      var todo = result.data;

      document.getElementById('editTodoId').value = todo.id;
      document.getElementById('editTitle').value = todo.title;
      document.getElementById('editDescription').value = todo.description || '';
      document.getElementById('editPriority').value = todo.priority;
      document.getElementById('editDueDate').value = todo.due_date ? todo.due_date.split('T')[0] : '';
      document.getElementById('editTags').value = (todo.tags || []).join(', ');

      var modal = document.getElementById('editModal');
      modal.classList.add('active');
    } catch (e) {
      console.error('openEdit failed:', e);
      showToast('Failed to open editor', 'error');
    }
  }

  async function handleEditTodo(e) {
    e.preventDefault();
    var id = document.getElementById('editTodoId').value;
    var tagsRaw = document.getElementById('editTags').value.trim();
    var tags = tagsRaw ? tagsRaw.split(',').map(function (t) { return t.trim(); }).filter(Boolean) : [];
    var dueDate = document.getElementById('editDueDate').value || null;

    var body = {
      title: document.getElementById('editTitle').value.trim(),
      description: document.getElementById('editDescription').value.trim(),
      priority: document.getElementById('editPriority').value,
      tags: tags,
    };
    if (dueDate) body.due_date = dueDate;

    try {
      await apiRequest(API_BASE + '/' + id, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      closeEditModal();
      showToast('Task updated!', 'success');
      loadTodos();
      loadStats();
    } catch (_e) {
      // error already handled
    }
  }

  function closeEditModal() {
    editModal.classList.remove('active');
  }

  // Mark complete (one-way: only marks as completed, never unchecks)
  async function toggleTodo(id) {
    try {
      await apiRequest(API_BASE + '/' + id, {
        method: 'PUT',
        body: JSON.stringify({ completed: true }),
      });
      loadTodos();
      loadStats();
    } catch (_e) {
      // error already handled
    }
  }

  // Delete todo
  async function deleteTodo(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await apiRequest(API_BASE + '/' + id, { method: 'DELETE' });
      showToast('Task deleted!', 'success');
      loadTodos();
      loadStats();
    } catch (_e) {
      // error already handled
    }
  }

  // Clear completed
  async function handleClearCompleted() {
    if (!confirm('Delete all completed todos?')) return;
    try {
      var result = await apiRequest(API_BASE, { method: 'DELETE' });
      showToast(result.message, 'success');
      loadTodos();
      loadStats();
    } catch (_e) {
      // error already handled
    }
  }

  // Pagination
  function goToPage(page) {
    currentPage = page;
    loadTodos();
  }

  // Helpers
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    var date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function showToast(message, type) {
    var container = document.getElementById('toastContainer');
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'success');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function () {
      toast.classList.add('toast-removing');
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

  // Expose to window for inline handlers
  window.todoApp = {
    toggleTodo: toggleTodo,
    openEdit: openEdit,
    deleteTodo: deleteTodo,
    goToPage: goToPage,
  };
})();
