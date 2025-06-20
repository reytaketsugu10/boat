console.log("✅ script.js 読み込み完了");

//const apiKey = 'YOUR_API_KEY_HERE'; // ここは適宜設定
//const folderMap = {
 // '住之江': 'FOLDER_ID_1',
 // '平和島': 'FOLDER_ID_2',
  // ... 他のフォルダも同様に
//};

async function fetchPDFFiles(folderId) {
  const query = `'${folderId}' in parents and mimeType='application/pdf' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&key=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();
  return data.files || [];
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

async function renderAll() {
  const container = document.getElementById('pdf-container');
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
      container.appendChild(block);
    }
  }

  if (!hasData) {
    const msg = document.createElement('p');
    msg.textContent = "データがありません。";
    container.appendChild(msg);
  }
}

renderAll();
