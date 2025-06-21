const apiKey = API_KEY_HERE;
const passwordEndpoint = 'https://script.google.com/macros/s/AKfycbzm8fZkF3aYcODW1J3qholjmhLVVmMSAJ5kNy57DAjwWD4OKILjCYZxxNlwIGdt8VNk/exec';

const authArea = document.getElementById('auth-area');
const loading = document.getElementById('loading');
const noData = document.getElementById('no-data');
const pdfContainer = document.getElementById('pdf-container');

document.getElementById('passwordInput').addEventListener('keypress', async (e) => {
  if (e.key === 'Enter') {
    const userInput = e.target.value.trim();
    const res = await fetch(passwordEndpoint);
    const data = await res.json();
    const correctPassword = data.password;

    if (userInput === correctPassword) {
      authArea.classList.add('hidden');
      loading.classList.remove('hidden');
      renderAll();
    } else {
      alert('パスワードが間違っています');
    }
  }
});

async function fetchPDFFiles(folderId) {
  const query = `'${folderId}' in parents and mimeType='application/pdf' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.files || [];
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
}

async function renderAll() {
  let hasData = false;
  for (const [title, folderId] of Object.entries(folderMap)) {
    const files = await fetchPDFFiles(folderId);
    if (files.length > 0) {
      hasData = true;

      const block = document.createElement('div');
      block.className = 'block';

      const heading = document.createElement('h2');
      heading.textContent = title;
      block.appendChild(heading);

      const list = document.createElement('ul');
      files.forEach(file => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = `https://drive.google.com/uc?id=${file.id}&export=download`;
        link.target = '_blank';
        link.textContent = `${file.name}（${formatDate(file.modifiedTime)}）`;
        li.appendChild(link);
        list.appendChild(li);
      });

      block.appendChild(list);
      pdfContainer.appendChild(block);
    }
  }

  loading.classList.add('hidden');
  if (hasData) {
    pdfContainer.classList.remove('hidden');
  } else {
    noData.classList.remove('hidden');
  }
}
