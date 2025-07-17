// src/web-ui/assets/js/app.js
const config = { apiBaseUrl: 'http://localhost:3000' };

let currentDoc = null;
let lastDocContent = '';
let currentView = 'plain'; // 'plain' or 'rendered'
let zoomLevel = 1;

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

    currentDoc = path;
    lastDocContent = text;
    currentView = 'plain';
    zoomLevel = 1;

    // Update UI
    document.getElementById('file-title').textContent = path.split('/').pop();
    document.getElementById('empty-state').style.display = 'none';

    // Clear previous rendered content
    document.getElementById('markdown-container').innerHTML = '';

    // Set initial view to plain text
    document.getElementById('plain-view').style.display = 'block';
    document.getElementById('plain-text-content').textContent = text;
    document.getElementById('rendered-view').style.display = 'none';
    document.getElementById('zoom-controls').style.display = 'none';

    // Show toggle button for supported file types
    const toggleBtn = document.getElementById('toggle-view');
    if (path.endsWith('.md') || path.endsWith('.mmd') || path.endsWith('.mermaid')) {
      toggleBtn.style.display = 'inline-block';
      toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
      toggleBtn.onclick = toggleDualView;
    } else {
      toggleBtn.style.display = 'none';
    }
  } catch (err) {
    console.error('Error loading file:', err);
    document.getElementById('empty-state').classList.add('d-none');
    document.getElementById('rendered-view').classList.remove('d-none');
    document.getElementById('rendered-view').innerHTML = 
      '<div class="alert alert-danger">Error loading file</div>';
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
    // Extract directory path and ensure new name maintains original location
    const lastSlash = oldPath.lastIndexOf('/');
    const directoryPath = lastSlash >= 0 ? oldPath.substring(0, lastSlash) : '';
    const newPath = directoryPath ? `${directoryPath}/${newName}` : newName;
    
    await fetch(`${config.apiBaseUrl}/file-manager/rename`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        oldPath: oldPath,
        newPath: newPath
      })
    });
    
    // Reload the current directory to show changes
    loadProjectStructure(directoryPath);
    showToast('File renamed successfully', 'success');
  } catch (error) {
    console.error('Error renaming file:', error);
    showToast('Error renaming file', 'danger');
  }
}

function resetFileView() {
  document.getElementById('file-title').textContent = 'Select a file';
  document.getElementById('empty-state').classList.remove('d-none');
  document.getElementById('rendered-view').classList.add('d-none');
  document.getElementById('code-view').classList.add('d-none');
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

  if (currentView === 'rendered') codeView.classList.remove('d-none');
  else codeView.classList.add('d-none');
}

function toggleDualView() {
  const plainView = document.getElementById('plain-view');
  const renderedView = document.getElementById('rendered-view');
  const toggleBtn = document.getElementById('toggle-view');
  const zoomControls = document.getElementById('zoom-controls');
  const markdownContainer = document.getElementById('markdown-container');

  if (currentView === 'plain') {
    // Switch to rendered view
    plainView.style.display = 'none';
    renderedView.style.display = 'block';
    currentView = 'rendered';
    toggleBtn.innerHTML = '<i class="fas fa-code"></i>';

    if (currentDoc.endsWith('.md')) {
      try {
        if (window.marked && typeof marked.parse === 'function') {
          markdownContainer.innerHTML = marked.parse(lastDocContent);
        } else {
          markdownContainer.innerHTML = '<div class="alert alert-danger">Markdown library not loaded</div>';
        }
      } catch (e) {
        markdownContainer.innerHTML = '<div class="alert alert-danger">Markdown render error</div>';
      }
      zoomControls.style.display = 'none';
    } else if (currentDoc.endsWith('.mmd') || currentDoc.endsWith('.mermaid')) {
      try {
        if (window.mermaid) {
          markdownContainer.innerHTML = `<div class="mermaid">${lastDocContent}</div>`;
          zoomControls.style.display = 'flex';
          zoomLevel = 1;
          mermaid.init(undefined, document.querySelector('.mermaid'));
          setupZoomControls();
        } else {
          markdownContainer.innerHTML = '<div class="alert alert-danger">Mermaid.js not loaded</div>';
          zoomControls.style.display = 'none';
        }
      } catch (e) {
        markdownContainer.innerHTML = '<div class="alert alert-danger">Mermaid render error</div>';
        zoomControls.style.display = 'none';
      }
    }
  } else {
    // Switch to plain view
    renderedView.style.display = 'none';
    plainView.style.display = 'block';
    currentView = 'plain';
    toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
    zoomControls.style.display = 'none';
    markdownContainer.innerHTML = '';
  }
}

// Zoom functionality for mermaid diagrams
function setupZoomControls() {
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');
  const zoomResetBtn = document.getElementById('zoom-reset');

  const updateZoom = () => {
    const svg = document.querySelector('.mermaid svg');
    if (svg) {
      svg.style.transform = `scale(${zoomLevel})`;
      svg.style.transformOrigin = 'top left';
    }
  };

  zoomInBtn.onclick = () => {
    zoomLevel = Math.min(zoomLevel + 0.1, 2);
    updateZoom();
  };

  zoomOutBtn.onclick = () => {
    zoomLevel = Math.max(zoomLevel - 0.1, 0.5);
    updateZoom();
  };

  zoomResetBtn.onclick = () => {
    zoomLevel = 1;
    updateZoom();
  };

  // Initial zoom update
  updateZoom();
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
