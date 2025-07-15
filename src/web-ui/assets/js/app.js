// Configuration
const config = {
  apiBaseUrl: 'http://localhost:3000' // Base URL for API requests
};

// Initialize Mermaid with dark theme
mermaid.initialize({ 
  startOnLoad: false, 
  theme: 'dark',
  fontFamily: '"Inter", sans-serif'
});

// Fetch project structure
async function loadProjectStructure() {
  try {
    const response = await fetch(`${config.apiBaseUrl}/documentation/project-structure`);
    const data = await response.json();
    renderFileTree(data);
  } catch (error) {
    console.error('Error loading project structure:', error);
    document.getElementById('file-tree').innerHTML = 'Error loading project structure';
  }
}

// Render file tree
function renderFileTree(structure) {
  const container = document.getElementById('file-tree');
  container.innerHTML = '';
  
  function createTree(items, parentEl) {
    const ul = document.createElement('ul');
    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'mb-1';
      
      if (item.type === 'directory') {
        li.innerHTML = `
          <div class="flex items-center cursor-pointer text-blue-400 hover:text-blue-300">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            ${item.name}
          </div>
        `;
        
        const childUl = document.createElement('ul');
        childUl.className = 'ml-4 hidden';
        li.appendChild(childUl);
        
        li.querySelector('div').addEventListener('click', () => {
          childUl.classList.toggle('hidden');
          
          if (childUl.children.length === 0) {
            loadDirectoryContents(item.path, childUl);
          }
        });
      } else {
        li.innerHTML = `
          <div class="flex items-center cursor-pointer text-blue-400 hover:text-blue-300" data-path="${item.path}">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            ${item.name}
          </div>
        `;
        
        li.querySelector('div').addEventListener('click', () => {
          loadFileContent(item.path);
        });
      }
      
      ul.appendChild(li);
    });
    
    parentEl.appendChild(ul);
  }
  
  createTree(structure, container);
}

// Load directory contents
async function loadDirectoryContents(directoryPath, parentElement) {
  try {
    const response = await fetch(`${config.apiBaseUrl}/documentation/directory?path=${encodeURIComponent(directoryPath)}`);
    const contents = await response.json();
    
    if (contents.length > 0) {
      const ul = document.createElement('ul');
      ul.className = 'ml-4';
      
      contents.forEach(item => {
        const li = document.createElement('li');
        li.className = 'mb-1';
        
        if (item.type === 'directory') {
          li.innerHTML = `
            <div class="flex items-center cursor-pointer text-blue-400 hover:text-blue-300">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              ${item.name}
            </div>
          `;
          
          const childUl = document.createElement('ul');
          childUl.className = 'ml-4 hidden';
          li.appendChild(childUl);
          
          li.querySelector('div').addEventListener('click', () => {
            childUl.classList.toggle('hidden');
            
            if (childUl.children.length === 0) {
              loadDirectoryContents(item.path, childUl);
            }
          });
        } else {
          li.innerHTML = `
            <div class="flex items-center cursor-pointer text-blue-400 hover:text-blue-300" data-path="${item.path}">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              ${item.name}
            </div>
          `;
          
          li.querySelector('div').addEventListener('click', () => {
            loadFileContent(item.path);
          });
        }
        
        ul.appendChild(li);
      });
      
      parentElement.appendChild(ul);
    }
  } catch (error) {
    console.error('Error loading directory contents:', error);
  }
}

// Load and render file content
async function loadFileContent(filePath) {
  try {
    markdownContainer.innerHTML = '<div class="flex justify-center items-center h-full"><div class="animate-pulse text-green-300">Loading content...</div></div>';
    
    const response = await fetch(`${config.apiBaseUrl}/documentation/file?path=${encodeURIComponent(filePath)}`);
    if (!response.ok) throw new Error('Failed to load file');
    
    const content = await response.text();
    
    if (filePath.endsWith('.md')) {
      // Render markdown with syntax highlighting
      markdownContainer.innerHTML = `
        <div class="max-w-4xl mx-auto prose prose-invert prose-sm md:prose-base">
          ${marked.parse(content)}
        </div>
      `;
      
      // Initialize Mermaid diagrams
      document.querySelectorAll('.mermaid').forEach(el => {
        try {
          mermaid.init(undefined, el);
        } catch (error) {
          console.error('Mermaid error:', error);
          el.innerHTML = `<div class="text-red-400">Diagram rendering error: ${error.message}</div>`;
        }
      });
    } else {
      // Display raw content with syntax highlighting
      markdownContainer.innerHTML = `
        <div class="max-w-4xl mx-auto">
          <pre class="bg-primary-800 p-4 rounded-lg overflow-x-auto"><code class="text-blue-400">${escapeHtml(content)}</code></pre>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading file:', error);
    markdownContainer.innerHTML = '<div class="text-center text-red-400 py-8">Error loading file content</div>';
  }
}

// Handle project upload
async function handleProjectUpload(e) {
  try {
    const files = e.target.files;
    if (!files.length) return;
    
    showToast('Generating documentation...', 'info');
    
    // Get the directory path from the first file's webkitRelativePath
    const directoryPath = files[0].webkitRelativePath 
      ? `/${files[0].webkitRelativePath.split('/')[0]}` 
      : files[0].path.split('/').slice(0, -1).join('/');
    
    // Reset file input
    e.target.value = '';
    
    const response = await fetch(`${config.apiBaseUrl}/documentation/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        projectPath: directoryPath
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Documentation generation failed');
    }
    
    await loadOutputFiles();
    showToast('Documentation generated successfully', 'success');
  } catch (error) {
    console.error('Generation error:', error);
    showToast(error.message || 'Error generating documentation', 'error');
  }
}

// Load output files from backend
async function loadOutputFiles() {
  try {
    outputFilesContainer.innerHTML = '<div class="p-4 text-center text-gray-500">Loading files...</div>';
    
    const response = await fetch(`${config.apiBaseUrl}/documentation/files`);
    if (!response.ok) throw new Error('Failed to load files');
    
    const files = await response.json();
    renderFileList(files);
  } catch (error) {
    console.error('Error loading files:', error);
    outputFilesContainer.innerHTML = '<div class="p-4 text-center text-red-500">Error loading files</div>';
  }
}

// Render file list
function renderFileList(files) {
  outputFilesContainer.innerHTML = '';
  
  if (!files.length) {
    outputFilesContainer.innerHTML = '<div class="p-4 text-center text-blue-400">No documentation files found</div>';
    return;
  }
  
  files.forEach(file => {
    const fileEl = document.createElement('div');
    fileEl.className = 'file-item flex items-center justify-between p-3 hover:bg-primary-700 cursor-pointer';
    fileEl.innerHTML = `
      <div class="flex items-center truncate text-blue-400" data-path="${file.path}">
        <svg class="flex-shrink-0 w-5 h-5 mr-3 ${file.type === 'directory' ? 'text-blue-400' : 'text-blue-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="${file.type === 'directory' ? 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' : 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'}" />
        </svg>
        <span class="truncate">${file.name}</span>
      </div>
      ${file.size ? `<span class="text-xs text-blue-400">${file.size}</span>` : ''}
    `;
    
    fileEl.addEventListener('click', () => {
      if (file.type === 'file') {
        currentFile = file.path;
        document.getElementById('file-title').textContent = file.name;
        loadFileContent(file.path);
      }
    });
    
    outputFilesContainer.appendChild(fileEl);
  });
}

// Delete current file
async function deleteCurrentFile() {
  if (!currentFile) {
    showToast('No file selected', 'warning');
    return;
  }
  
  try {
    // Confirm deletion
    if (!confirm(`Delete ${currentFile.split('/').pop()}? This cannot be undone.`)) return;
    
    // Delete file via API
    const response = await fetch(`${config.apiBaseUrl}/documentation/file?path=${encodeURIComponent(currentFile)}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Delete failed');
    
    // Refresh file list
    await loadOutputFiles();
    
    // Clear viewer
    markdownContainer.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Select a file to view</div>';
    document.getElementById('file-title').textContent = 'Select a file to view';
    currentFile = null;
    
    showToast('File deleted', 'success');
  } catch (error) {
    console.error('Delete error:', error);
    showToast('Error deleting file', 'error');
  }
}

// Show toast notification
function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-md shadow-lg text-sm font-medium animate-fade-in ${type === 'error' ? 'bg-red-900/80 border-red-700 text-red-100' : type === 'success' ? 'bg-green-900/80 border-green-700 text-green-100' : 'bg-primary-700 border-primary-600 text-blue-400'}`;
  
  setTimeout(() => {
    toast.classList.remove('animate-fade-in');
    toast.classList.add('animate-fade-out');
    setTimeout(() => toast.classList.add('hidden'), 150);
  }, 3000);
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// DOM Elements
const uploadInput = document.getElementById('project-upload');
const refreshBtn = document.getElementById('refresh-files');
const deleteBtn = document.getElementById('delete-file');
const outputFilesContainer = document.getElementById('output-files');
const markdownContainer = document.getElementById('markdown-content');
const toast = document.getElementById('toast');
let currentFile = null;

// Style upload button while preserving text
if (uploadInput) {
  const uploadLabel = uploadInput.closest('label') || uploadInput.previousElementSibling;
  if (uploadLabel) {
    uploadLabel.className = 'flex items-center justify-center px-4 py-2 bg-primary-800 rounded-md text-blue-400 hover:bg-primary-700 border border-blue-400 transition-colors cursor-pointer';
    
    // Add icon while preserving existing text
    const icon = document.createElement('svg');
    icon.className = 'w-5 h-5 mr-2 text-blue-400';
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />';
    uploadLabel.prepend(icon);
  }
}

// Style action buttons
if (refreshBtn) {
  refreshBtn.className = 'flex items-center px-4 py-2 bg-primary-800 rounded-md text-blue-400 hover:bg-primary-700 border border-blue-400 transition-colors';
}

if (deleteBtn) {
  deleteBtn.className = 'flex items-center px-4 py-2 bg-primary-800 rounded-md text-blue-400 hover:bg-primary-700 border border-blue-400 transition-colors';
}

// Event Listeners
uploadInput.addEventListener('change', handleProjectUpload);
refreshBtn.addEventListener('click', loadOutputFiles);
deleteBtn.addEventListener('click', deleteCurrentFile);

// Initialize
loadProjectStructure();
loadOutputFiles();
markdownContainer.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Select a file to view</div>';
