console.log("upload.js 読み込み完了");

// 認証に必要な情報
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let selectedFiles = [];

// Google API 初期化
function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}
window.gapiLoaded = gapiLoaded;

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: '', // 実際の処理内で設定
  });
  gisInited = true;
}
window.gisLoaded = gisLoaded;

async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: apiKey,
    discoveryDocs: [
      'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
      'https://sheets.googleapis.com/$discovery/rest?version=v4',
    ],
  });
  gapiInited = true;
  maybeEnableUpload();
}

function maybeEnableUpload() {
  if (gapiInited && gisInited) {
    document.getElementById('uploadBtn').disabled = false;
  }
}

// DOM構築後にイベント登録
window.addEventListener('DOMContentLoaded', () => {
  const dropArea = document.getElementById('drop-area');
  const fileElem = document.getElementById('fileElem');
  const uploadBtn = document.getElementById('uploadBtn');

  // ドラッグ＆ドロップ処理
  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropArea.classList.add('highlight');
    }, false);
  });
  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropArea.classList.remove('highlight');
    }, false);
  });

  dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    const dt = e.dataTransfer;
    const files = Array.from(dt.files);

    selectedFiles = files.filter(file => file.type === "application/pdf");

    if (selectedFiles.length === 0) {
      alert("PDFファイルをドロップしてください");
      return;
    }

    console.log("ドロップされたファイル:", selectedFiles.map(f => f.name));
    uploadBtn.disabled = false;
  });

  // ボタンから選択
  fileElem.addEventListener('change', (e) => {
    selectedFiles = Array.from(e.target.files).filter(file => file.type === "application/pdf");

    if (selectedFiles.length === 0) {
      alert("PDFファイルを選択してください");
      return;
    }

    console.log("選択されたファイル:", selectedFiles.map(f => f.name));
    uploadBtn.disabled = false;
  });

  // アップロード処理
  uploadBtn.addEventListener('click', async () => {
    console.log("✅ アップロードボタンがクリックされました");

    if (!selectedFiles.length) {
      alert("ファイルを選択またはドロップしてください");
      return;
    }

    tokenClient.callback = async (resp) => {
      if (resp.error) throw resp;

      for (const file of selectedFiles) {
        const title = extractTitleFromFilename(file.name);
        if (!title || !folderMap[title]) {
          alert(`対応する地名が見つかりません: ${file.name}`);
          continue;
        }

        const metadata = {
          name: file.name,
          parents: [folderMap[title]],
          mimeType: 'application/pdf'
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: new Headers({ Authorization: `Bearer ${gapi.auth.getToken().access_token}` }),
          body: form,
        });

        const uploadedFile = await uploadRes.json();
        const now = new Date().toISOString();

        await gapi.client.sheets.spreadsheets.values.append({
          spreadsheetId: spreadsheetId,
          range: 'A:D',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: [[title, file.name, uploadedFile.id, now]]
          }
        });

        console.log(`✅ アップロード成功: ${file.name}`);
      }

      alert("すべてのファイルをアップロードしました。");
      selectedFiles = [];
      uploadBtn.disabled = true;
      fileElem.value = '';
    };

    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
});

// ファイル名から地名を推測
function extractTitleFromFilename(filename) {
  for (const title in folderMap) {
    if (filename.includes(title)) {
      return title;
    }
  }
  return null;
}
