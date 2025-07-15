/* src/web-ui/assets/js/app.js */
const config = {
  apiBaseUrl: 'http://localhost:3000'
};

//
// File-Manager: List / view / delete / rename
//

// 1. Load directory listing (root or sub-folder)
async function loadProjectStructure(folder = '') {
  try {
    const res = await fetch(`${config.apiBaseUrl}/file-manager/list?folder=${encodeURIComponent(folder)}`);
    const items = await res.json();
    renderFileTree(items, document.getElementById('file-tree'));
  } catch (err) {
    console.error('Error loading project structure:', err);
    document.getElementById('file-tree').innerHTML =
      '<div class="text-red-400 p-4">Error loading project structure</div>';
  }
}

// 2. Render the tree into a nested list
function renderFileTree(items, parent) {
  parent.innerHTML = '';
  const ul = document.createElement('ul');
  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'p-2 hover:bg-primary-700 cursor-pointer flex justify-between items-center';
    const span = document.createElement('span');
    span.textContent = item.name;
    span.className = item.isDirectory ? 'font-bold' : '';
    span.addEventListener('click', () => {
      item.isDirectory ? loadProjectStructure(item.path) : loadFileContent(item.path);
    });
    li.appendChild(span);

    if (!item.isDirectory) {
      const delBtn = document.createElement('button');
      delBtn.innerHTML = '🗑';
      delBtn.className = 'ml-2';
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        deleteFileManagerItem(item.path, 'file');
      });
      li.appendChild(delBtn);
    }

    ul.appendChild(li);
  });
  parent.appendChild(ul);
}

// 3. Load file contents
async function loadFileContent(path) {
  try {
    const res = await fetch(`${config.apiBaseUrl}/file-manager/content?file=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error('Failed to load file');
    const text = await res.text();
    document.getElementById('markdown-content').innerHTML =
      `<pre class="bg-primary-800 p-4 rounded-lg overflow-x-auto text-blue-400">${escapeHtml(text)}</pre>`;
  } catch (err) {
    console.error('Error loading file content:', err);
    document.getElementById('markdown-content').innerHTML =
      '<div class="text-red-400 p-4">Error loading file content</div>';
  }
}

// 4. Delete a file or folder
async function deleteFileManagerItem(path, type) {
  try {
    const url = type === 'directory'
      ? `${config.apiBaseUrl}/file-manager/folder?folder=${encodeURIComponent(path)}`
      : `${config.apiBaseUrl}/file-manager/file?file=${encodeURIComponent(path)}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    loadProjectStructure();
    showToast(`${type === 'directory' ? 'Folder' : 'File'} deleted`, 'success');
  } catch (err) {
    console.error('Delete error:', err);
    showToast('Error deleting item', 'error');
  }
}

// 5. Rename (example usage, you'd wire this to a form/button)
async function renameFileManagerPath(oldPath, newPath) {
  try {
    const res = await fetch(`${config.apiBaseUrl}/file-manager/rename`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath, newPath })
    });
    if (!res.ok) throw new Error('Rename failed');
    loadProjectStructure();
    showToast('Renamed successfully', 'success');
  } catch (err) {
    console.error('Rename error:', err);
    showToast('Error renaming', 'error');
  }
}

//
// Documentation: List / view / delete / generate
//

let currentDoc = null;

// 6. List generated docs
async function loadDocumentationFiles() {
  try {
    const res = await fetch(`${config.apiBaseUrl}/documentation/files`);
    const files = await res.json();
    renderDocumentationList(files);
  } catch (err) {
    console.error('Error loading docs:', err);
    document.getElementById('output-files').innerHTML =
      '<div class="text-red-400 p-4">Error loading documentation files</div>';
  }
}

// 7. Render docs list
function renderDocumentationList(files) {
  const container = document.getElementById('output-files');
  container.innerHTML = '';
  files.forEach(file => {
    const div = document.createElement('div');
    div.className = 'p-2 hover:bg-primary-700 cursor-pointer flex justify-between';
    div.textContent = file.name;
    div.addEventListener('click', () => {
      currentDoc = file.path;
      document.getElementById('file-title').textContent = file.name;
      loadDocumentationContent(file.path);
    });
    container.appendChild(div);
  });
}

// 8. View a doc
async function loadDocumentationContent(path) {
  try {
    const res = await fetch(`${config.apiBaseUrl}/documentation/file?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error('Failed to load doc');
    const text = await res.text();
    const contentEl = document.querySelector('#markdown-content .prose');
    contentEl.innerHTML = marked.parse(text);
    mermaid.init(undefined, document.querySelectorAll('.mermaid'));
  } catch (err) {
    console.error('Error loading doc content:', err);
    document.getElementById('markdown-content').innerHTML =
      '<div class="text-red-400 p-4">Error loading documentation content</div>';
  }
}

// 9. Delete a doc
async function deleteDocumentationFile() {
  if (!currentDoc) { showToast('No file selected', 'warning'); return; }
  try {
    const res = await fetch(`${config.apiBaseUrl}/documentation/file?path=${encodeURIComponent(currentDoc)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Delete failed');
    loadDocumentationFiles();
    document.getElementById('markdown-content').innerHTML = '';
    showToast('Documentation deleted', 'success');
  } catch (err) {
    console.error('Delete doc error:', err);
    showToast('Error deleting documentation', 'error');
  }
}

// 10. Generate docs from a folder
async function generateDocumentation(projectPath) {
  try {
    const res = await fetch(`${config.apiBaseUrl}/documentation/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath })
    });
    if (!res.ok) throw new Error('Generation failed');
    showToast('Documentation generated', 'success');
    loadDocumentationFiles();
  } catch (err) {
    console.error('Generate error:', err);
    showToast('Error generating documentation', 'error');
  }
}

// Utility: toast & HTML escape
function showToast(message, type='info') {
  const t = document.getElementById('toast');
  t.textContent = message;
  t.className = `fixed bottom-4 right-4 px-4 py-2 rounded-md shadow-lg text-sm font-medium ${
    type==='error' ? 'bg-red-900' : type==='success' ? 'bg-green-900' : 'bg-primary-800'
  }`;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}
function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Wire up controls
document.getElementById('refresh-structure').addEventListener('click', () => loadProjectStructure());
document.getElementById('refresh-files').addEventListener('click', loadDocumentationFiles);
document.getElementById('delete-file').addEventListener('click', deleteDocumentationFile);
document.getElementById('project-upload').addEventListener('change', e => {
  const dir = e.target.files[0]?.webkitRelativePath.split('/')[0] || '';
  generateDocumentation(`/${dir}`);
});

// Initialize both panes
loadProjectStructure();
loadDocumentationFiles();

/*
  This script now:
  - Uses `/file-manager/...` endpoints to browse, view, delete and rename project files.
  - Uses `/documentation/...` endpoints to list, view, delete and generate Markdown docs.
  - Hooks each button and list item to the correct controller path.  
*/
