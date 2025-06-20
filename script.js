console.log("script.js 読み込まれました！");

async function init() {
  await gapi.client.init({
    apiKey: apiKey,
    discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
  });

  const res = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: 'A:D',
  });

  const rows = res.result.values;
  if (!rows || rows.length < 2) return;

  const now = Date.now();
 // const cutoff = 20 * 60 * 60 * 1000; (20時間で消すためのコード)
  const container = document.getElementById('pdf-container');
  const grouped = {};

  rows.slice(1).forEach(([title, filename, fileId, uploadedAt]) => {
    const uploadedTime = new Date(uploadedAt).getTime();
    if (now - uploadedTime < cutoff) {
      if (!grouped[title]) grouped[title] = [];
      grouped[title].push({ filename, fileId, uploadedAt });
    }
  });

  for (const title in grouped) {
    const block = document.createElement('div');
    block.className = 'block';

    const heading = document.createElement('h2');
    heading.textContent = title;
    block.appendChild(heading);

    const list = document.createElement('ul');
    grouped[title].forEach(file => {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = `https://drive.google.com/uc?id=${file.fileId}&export=download`;
      link.target = '_blank';
      link.textContent = `${file.filename}（${formatDate(file.uploadedAt)}）`;
      li.appendChild(link);
      list.appendChild(li);
    });

    block.appendChild(list);
    container.appendChild(block);
  }
}

function formatDate(str) {
  const d = new Date(str);
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

gapi.load('client', init);
