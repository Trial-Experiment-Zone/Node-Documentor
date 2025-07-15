// src/web-ui/assets/js/app.js
const config = { apiBaseUrl: 'http://localhost:3000' };

let currentDoc = null;
let lastDocContent = '';
let dualView = false;

//
// File-Manager: List / view / delete / rename
//

async function loadProjectStructure(folder = '') {
  try {
    const res = await fetch(`${config.apiBaseUrl}/file-manager/list?folder=${encodeURIComponent(folder)}`);
    const items = await res.json();
    renderFileTree(items);
  } catch {
    document.getElementById('file-tree').innerHTML = '<div class="text-danger p-2">Error loading structure</div>';
  }
}

function renderFileTree(items) {
  const container = document.getElementById('file-tree');
  container.innerHTML = '';
  
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'd-flex align-items-center mb-2';
    
    const icon = document.createElement('i');
    icon.className = item.isDirectory ? 'fas fa-folder text-warning me-2' : 'fas fa-file text-muted me-2';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'flex-grow-1';
    nameSpan.textContent = item.name;
    
    div.append(icon, nameSpan);
    
    if (!item.isDirectory) {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-link text-secondary p-0 ms-2';
      editBtn.innerHTML = '<i class="fas fa-edit"></i>';
      editBtn.title = 'Rename file';
      editBtn.onclick = e => {
        e.stopPropagation();
        const newName = prompt('New file name:', item.name);
        if (newName) renameFileManagerPath(item.path, newName);
      };
      
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-link text-danger p-0 ms-1';
      delBtn.innerHTML = '<i class="fas fa-trash"></i>';
      delBtn.title = 'Delete file';
      delBtn.onclick = e => {
        e.stopPropagation();
        deleteFileManagerItem(item.path, 'file');
      };
      
      div.append(editBtn, delBtn);
    }
    
    div.onclick = () => {
      if (item.isDirectory) loadProjectStructure(item.path);
      else loadFileContent(item.path);
    };
    
    container.append(div);
  });
}

async function loadFileContent(path) {
  try {
    const res = await fetch(`${config.apiBaseUrl}/file-manager/content?file=${encodeURIComponent(path)}`);
    const text = await res.text();
    document.getElementById('markdown-content').innerHTML =
      `<pre class="bg-light p-3 text-monospace">${escapeHtml(text)}</pre>`;
  } catch {
    document.getElementById('markdown-content').innerHTML = '<div class="text-danger p-2">Error loading file</div>';
  }
}

async function deleteFileManagerItem(path, type) {
  const url = type === 'directory'
    ? `${config.apiBaseUrl}/file-manager/folder?folder=${encodeURIComponent(path)}`
    : `${config.apiBaseUrl}/file-manager/file?file=${encodeURIComponent(path)}`;
  try {
    await fetch(url, { method: 'DELETE' });
    loadProjectStructure();
    showToast('Deleted', 'success');
  } catch {
    showToast('Error deleting', 'danger');
  }
}

async function renameFileManagerPath(oldPath, newName) {
  try {
    await fetch(`${config.apiBaseUrl}/file-manager/rename`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath, newPath: newName })
    });
    loadProjectStructure();
    showToast('Renamed', 'success');
  } catch {
    showToast('Error renaming', 'danger');
  }
}

//
// Documentation: List / view / delete / generate
//

async function loadDocumentationFiles() {
  try {
    const res = await fetch(`${config.apiBaseUrl}/documentation/files`);
    const files = await res.json();
    renderDocumentationList(files);
  } catch {
    document.getElementById('output-files').innerHTML = '<div class="text-danger p-2">Error loading docs</div>';
  }
}

function renderDocumentationList(files) {
  const container = document.getElementById('output-files');
  container.innerHTML = '';
  files.forEach(file => {
    const div = document.createElement('div');
    div.className = 'list-group-item d-flex justify-content-between align-items-center';
    div.textContent = file.name;
    div.onclick = () => loadDocumentationContent(file.path, file.name);
    container.append(div);
  });
}

async function loadDocumentationContent(path, name) {
  try {
    const res = await fetch(`${config.apiBaseUrl}/documentation/file?path=${encodeURIComponent(path)}`);
    const text = await res.text();
    currentDoc = path;
    lastDocContent = text;
    document.getElementById('file-title').textContent = name;
    renderDocView(text);
  } catch {
    document.getElementById('markdown-content').innerHTML = '<div class="text-danger p-2">Error loading doc</div>';
  }
}

function renderDocView(text) {
  // Rendered
  const rendered = document.getElementById('rendered-view');
  rendered.innerHTML = marked.parse(text);
  mermaid.init(undefined, rendered.querySelectorAll('.mermaid'));

  // Source
  const codeView = document.getElementById('code-view');
  document.getElementById('code-content').textContent = text;

  if (dualView) codeView.classList.remove('d-none');
  else codeView.classList.add('d-none');
}

function toggleDualView() {
  dualView = !dualView;
  if (lastDocContent) renderDocView(lastDocContent);
}

async function deleteDocumentationFile() {
  if (!currentDoc) return showToast('No file selected', 'warning');
  try {
    await fetch(`${config.apiBaseUrl}/documentation/file?path=${encodeURIComponent(currentDoc)}`, { method: 'DELETE' });
    loadDocumentationFiles();
    document.getElementById('markdown-content').innerHTML = '';
    showToast('Deleted doc', 'success');
  } catch {
    showToast('Error deleting doc', 'danger');
  }
}

async function generateDocumentation(projectPath) {
  try {
    await fetch(`${config.apiBaseUrl}/documentation/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath })
    });
    showToast('Docs generated', 'success');
    loadDocumentationFiles();
  } catch {
    showToast('Error generating docs', 'danger');
  }
}

//
// Utilities
//

function showToast(msg, type='info') {
  const toast = document.createElement('div');
  toast.className = `alert alert-${type} position-fixed bottom-0 end-0 m-3`;
  toast.textContent = msg;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, ch =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[ch]
  );
}

// Wire up controls
document.getElementById('refresh-structure').onclick = () => loadProjectStructure();
document.getElementById('refresh-files').onclick     = () => loadDocumentationFiles();
document.getElementById('delete-file').onclick       = deleteDocumentationFile;
document.getElementById('toggle-view').onclick       = toggleDualView;
document.getElementById('project-upload').onchange   = e => {
  const dir = e.target.files[0]?.webkitRelativePath.split('/')[0] || '';
  generateDocumentation(`/${dir}`);
};

// Initialize
loadProjectStructure();
loadDocumentationFiles();
